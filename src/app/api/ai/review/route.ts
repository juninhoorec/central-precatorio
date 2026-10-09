import { NextResponse } from "next/server";
import { z } from "zod";
import { globalHumanReviewStore, humanReviewRecordSchema } from "@/lib/ai/ai-human-review";
import { globalPilotRepository } from "@/lib/ai/ai-pilot-corpus";
import { aiPilotRunOwnsItem } from "@/lib/ai/ai-pilot-run-store";
import { appendAudit } from "@/lib/audit";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";
import { rateLimit } from "@/lib/rate-limit";

const reviewInputSchema = humanReviewRecordSchema.omit({ id: true, organizationId: true, reviewer: true, reviewedAt: true }).strict();

export async function GET(req: Request) {
  try {
    const tenant = await requireTenantPermission(req.headers, "ai:pilot:read");
    const corpusItemId = new URL(req.url).searchParams.get("corpusItemId");
    if (corpusItemId) {
      if (!z.uuid().safeParse(corpusItemId).success || !globalPilotRepository.getById(corpusItemId, tenant.organizationId)) {
        return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
      }
      return NextResponse.json({ reviews: globalHumanReviewStore.getForCorpusItem(corpusItemId, tenant.organizationId) }, { headers: { "cache-control": "no-store" } });
    }
    return NextResponse.json({ reviews: globalHumanReviewStore.getAll(tenant.organizationId) }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível consultar as revisões." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const tenant = await requireTenantPermission(req.headers, "ai:pilot:write");
    if (!(await rateLimit(req, "ai-human-review", 30, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de revisões humanas atingido." }, { status: 429 });
    }
    const body = await readJsonBody(req, 8 * 1024);
    if (!body.ok) return NextResponse.json({ error: body.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: body.reason === "too_large" ? 413 : 400 });
    const parsed = reviewInputSchema.safeParse(body.value);
    if (!parsed.success) return NextResponse.json({ error: "Revisão inválida." }, { status: 400 });
    if (!globalPilotRepository.getById(parsed.data.corpusItemId, tenant.organizationId)) {
      return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
    }
    if (!aiPilotRunOwnsItem(parsed.data.aiRunId, tenant.organizationId, parsed.data.corpusItemId)) {
      return NextResponse.json({ error: "Execução de IA não encontrada para este item e organização." }, { status: 404 });
    }
    const record = humanReviewRecordSchema.parse({
      ...parsed.data,
      id: crypto.randomUUID(),
      organizationId: tenant.organizationId,
      reviewer: tenant.userId,
      reviewedAt: new Date().toISOString(),
    });
    const saved = globalHumanReviewStore.recordReview(record);
    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "AI_HUMAN_REVIEW_RECORDED",
      entityType: "ai_human_review",
      entityId: saved.id,
      previousStateSummary: {},
      nextStateSummary: { decision: saved.decision, reason: saved.reason },
      metadata: { corpusItemId: saved.corpusItemId, aiRunId: saved.aiRunId },
      requestId: req.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
      source: "AI_HUMAN_REVIEW_API",
    });
    return NextResponse.json({ ok: true, review: saved }, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível registrar a revisão humana." }, { status: 500 });
  }
}
