import { NextResponse } from "next/server";
import { z } from "zod";
import { globalPilotRepository } from "@/lib/ai/ai-pilot-corpus";
import { runPilotEvaluation } from "@/lib/ai/ai-evaluator";
import { recordAiPilotRun } from "@/lib/ai/ai-pilot-run-store";
import { appendAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";

const promptSchema = z.string().trim().regex(/^v[0-9]{1,4}$/);
const bodySchema = z.object({ promptVersion: promptSchema.default("v1") }).strict();

async function evaluate(request: Request, promptVersion: string) {
  const tenant = await requireTenantPermission(request.headers, "ai:pilot:write");
  if (!(await rateLimit(request, "ai-pilot-evaluate", 10, 600, `${tenant.organizationId}:${tenant.userId}`))) {
    return NextResponse.json({ error: "Limite de avaliações atingido." }, { status: 429 });
  }
  const items = globalPilotRepository.getAll(tenant.organizationId);
  const scorecard = await runPilotEvaluation(items, promptVersion);
  const runId = crypto.randomUUID();
  recordAiPilotRun({ id: runId, organizationId: tenant.organizationId, corpusItemIds: scorecard.results.map((item) => item.corpusItemId) });
  await appendAudit({
    organizationId: tenant.organizationId,
    actorUserId: tenant.userId,
    action: "AI_PILOT_EVALUATION_RUN",
    entityType: "ai_pilot_run",
    entityId: runId,
    previousStateSummary: {},
    nextStateSummary: { corpusItems: scorecard.totalCases },
    metadata: { promptVersion },
    requestId: request.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
    source: "AI_EVALUATION_API",
  });
  return NextResponse.json({ ...scorecard, runId }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const content = await readJsonBody(req, 4096);
    if (!content.ok) return NextResponse.json({ error: content.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: content.reason === "too_large" ? 413 : 400 });
    const body = bodySchema.safeParse(content.value);
    if (!body.success) return NextResponse.json({ error: "Payload de avaliação inválido." }, { status: 400 });
    return await evaluate(req, body.data.promptVersion);
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível executar a avaliação." }, { status: 502 });
  }
}
