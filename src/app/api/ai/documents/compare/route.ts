import { NextResponse } from "next/server";
import { z } from "zod";
import { compareDocuments } from "@/lib/ai/document-evidence-engine";
import { appendAudit } from "@/lib/audit";
import { documentStorage } from "@/lib/document-storage";
import { extractPdfText } from "@/lib/pdf-analysis";
import { requireTenantPermission } from "@/lib/tenant";

export const runtime = "nodejs";

const compareRequestSchema = z.object({
  sourceDocumentId: z.string().uuid(),
  targetDocumentId: z.string().uuid()
}).strict();

export async function POST(req: Request) {
  try {
    const tenant = await requireTenantPermission(req.headers, "document:read");
    const parsed = compareRequestSchema.safeParse(await req.json());

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
    console.error("Error in /api/ai/documents/compare:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
