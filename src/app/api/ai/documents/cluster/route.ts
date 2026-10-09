import { NextResponse } from "next/server";
import { z } from "zod";
import { buildCrossDocumentContext } from "@/lib/ai/cross-document-engine";
import { appendAudit } from "@/lib/audit";
import { documentStorage } from "@/lib/document-storage";
import { extractPdfText } from "@/lib/pdf-analysis";
import { getOperation } from "@/lib/operations";
import { requireTenantPermission } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const tenant = await requireTenantPermission(req.headers, "document:read");
    if (!(await rateLimit(req, "ai-document-cluster", 10, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de análises documentais atingido." }, { status: 429 });
    }
    const content = await readJsonBody(req, 2048);
    if (!content.ok) return NextResponse.json({ error: content.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: content.reason === "too_large" ? 413 : 400 });
    const body = z.object({ operationId: z.uuid() }).strict().safeParse(content.value);

    if (!body.success) {
      return NextResponse.json(
        { error: "operationId inválido." },
        { status: 400 }
      );
    }
    const { operationId } = body.data;

    const operation = await getOperation(operationId, undefined, tenant.organizationId);
    if (!operation) {
      return NextResponse.json(
        { error: "Operation not found" },
        { status: 404 }
      );
    }

    const docs = await documentStorage.list(operationId, tenant.organizationId);
    
    // Filter out ARCHIVED or REJECTED docs to only cross-analyze valid ones
    const activeDocs = docs.filter((d) => ["SAFE", "UPLOADED"].includes(d.status) && d.size <= 5_000_000).slice(0, 20);

    const documentsNotAnalyzed: string[] = [];
    const documentsData = await Promise.all(
      activeDocs.map(async (doc) => {
        try {
          const file = await documentStorage.createPrivateAccess(doc.id, tenant.organizationId);
          if (!file) {
            documentsNotAnalyzed.push(doc.name);
            return null;
          }
          const extracted = await extractPdfText(new Uint8Array(file.bytes));
          return {
            id: doc.id,
            name: doc.name,
            createdAt: doc.createdAt,
            organizationId: tenant.organizationId,
            textPages: extracted.pages
          };
        } catch {
          documentsNotAnalyzed.push(doc.name);
          return null;
        }
      })
    );

    const validDocumentsData = documentsData.filter((d): d is NonNullable<typeof d> => d !== null);

    const analysis = buildCrossDocumentContext(operation, validDocumentsData, documentsNotAnalyzed);
    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "CROSS_DOCUMENT_ANALYSIS_RUN",
      entityType: "operation",
      entityId: operationId,
      previousStateSummary: {},
      nextStateSummary: { documentsAnalyzed: analysis.documentsAnalyzed, pagesAnalyzed: analysis.coverage.pagesAnalyzed },
      metadata: { relationCount: analysis.relations.length, conflictCount: analysis.conflicts.length, partial: analysis.coverage.partial },
      requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
      source: "CROSS_DOCUMENT_API"
    });

    return NextResponse.json(analysis, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível analisar os documentos." }, { status: 500 });
  }
}
