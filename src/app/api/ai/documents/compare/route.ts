import { NextResponse } from "next/server";
import { z } from "zod";
import { compareDocuments } from "@/lib/ai/document-evidence-engine";
import { appendAudit } from "@/lib/audit";
import { documentStorage } from "@/lib/document-storage";
import { extractPdfText } from "@/lib/pdf-analysis";
import { requireTenantPermission } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-validation";

export const runtime = "nodejs";

const compareRequestSchema = z.object({
  sourceDocumentId: z.string().uuid(),
  targetDocumentId: z.string().uuid()
}).strict();

export async function POST(req: Request) {
  try {
    const tenant = await requireTenantPermission(req.headers, "document:read");
    if (!(await rateLimit(req, "ai-document-compare", 10, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de comparações documentais atingido." }, { status: 429 });
    }
    const content = await readJsonBody(req, 2048);
    if (!content.ok) return NextResponse.json({ error: content.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: content.reason === "too_large" ? 413 : 400 });
    const parsed = compareRequestSchema.safeParse(content.value);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "sourceDocumentId e targetDocumentId devem ser UUIDs válidos." },
        { status: 400 }
      );
    }
    const { sourceDocumentId, targetDocumentId } = parsed.data;

    const fileA = await documentStorage.createPrivateAccess(sourceDocumentId, tenant.organizationId);
    const fileB = await documentStorage.createPrivateAccess(targetDocumentId, tenant.organizationId);

    if (!fileA || !fileB) {
      return NextResponse.json(
        { error: "One or both documents not found" },
        { status: 404 }
      );
    }
    if (!["SAFE", "UPLOADED"].includes(fileA.metadata.status) || !["SAFE", "UPLOADED"].includes(fileB.metadata.status)
      || fileA.metadata.size > 5_000_000 || fileB.metadata.size > 5_000_000) {
      return NextResponse.json({ error: "Os dois documentos precisam estar disponíveis e dentro do limite de análise." }, { status: 404 });
    }
    if (fileA.metadata.operationId !== fileB.metadata.operationId) {
      return NextResponse.json(
        { error: "Só é permitido comparar documentos da mesma operação." },
        { status: 409 }
      );
    }

    const extractedA = await extractPdfText(new Uint8Array(fileA.bytes));
    const extractedB = await extractPdfText(new Uint8Array(fileB.bytes));

    const result = await compareDocuments(
      sourceDocumentId,
      extractedA.pages,
      targetDocumentId,
      extractedB.pages
    );

    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "CROSS_DOCUMENT_ANALYSIS_RUN",
      entityType: "operation",
      entityId: fileA.metadata.operationId,
      previousStateSummary: {},
      nextStateSummary: { sourceDocumentId, targetDocumentId, differences: result.deterministicDifferences.length },
      metadata: { task: "DOCUMENT_COMPARISON" },
      requestId: req.headers.get("x-request-id") || crypto.randomUUID(),
      source: "CROSS_DOCUMENT_COMPARE_API"
    });

    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível comparar os documentos." }, { status: 500 });
  }
}
