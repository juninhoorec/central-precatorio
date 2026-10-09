import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { searchDocumentEvidence } from "@/lib/ai/document-evidence-engine";
import { documentStorage } from "@/lib/document-storage";
import { extractPdfText } from "@/lib/pdf-analysis";
import { appendAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";

const requestSchema = z.object({
  documentId: z.uuid(),
  query: z.string().trim().min(1).max(500),
  requireExactMatch: z.boolean().optional().default(false),
}).strict();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req: Request) {
  try {
    const startedAt = Date.now();
    requireSameOrigin(req);
    const tenant = await requireTenantPermission(req.headers, "document:read");
    if (!(await rateLimit(req, "ai-document-search", 30, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de pesquisas atingido." }, { status: 429 });
    }
    const body = await readJsonBody(req, 4096);
    if (!body.ok) return NextResponse.json({ error: body.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: body.reason === "too_large" ? 413 : 400 });
    const parsed = requestSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Parâmetros de pesquisa inválidos." }, { status: 400 });

    const { documentId, query, requireExactMatch } = parsed.data;
    const file = await documentStorage.createPrivateAccess(documentId, tenant.organizationId);
    if (!file || !["SAFE", "UPLOADED"].includes(file.metadata.status)) {
      return NextResponse.json({ error: "Documento não encontrado ou indisponível." }, { status: 404 });
    }
    const extracted = await extractPdfText(new Uint8Array(file.bytes));
    const result = searchDocumentEvidence(
      documentId,
      tenant.organizationId,
      extracted.pages,
      query
    );
    const normalizedQuery = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const exactPattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedQuery)}($|[^a-z0-9])`, "i");
    const evidenceItems = requireExactMatch
      ? result.evidenceItems.filter((item) => exactPattern.test(item.normalizedText))
      : result.evidenceItems;
    const queryHash = createHash("sha256").update(normalizedQuery).digest("hex");
    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "DOCUMENT_SEARCHED",
      entityType: "document",
      entityId: documentId,
      previousStateSummary: {},
      nextStateSummary: { matchCount: evidenceItems.length, exactMatch: requireExactMatch },
      metadata: { queryHash, operationId: file.metadata.operationId },
      requestId: req.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
      source: "AI_DOCUMENT_SEARCH_API",
    });

    return NextResponse.json({
      ...result,
      evidenceItems,
      findingsCount: evidenceItems.length,
      executionTimeMs: Date.now() - startedAt,
      matches: evidenceItems.map(item => ({
        pageIndex: item.page - 1,
        text: item.textSpan,
        score: item.confidence,
        context: item.textSpan,
        isExact: item.strength === "EXPLICIT" || item.strength === "STRONG_CONTEXT"
      }))
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível pesquisar o documento." }, { status: 500 });
  }
}
