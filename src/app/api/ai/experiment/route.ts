import { NextResponse } from "next/server";
import { z } from "zod";
import { runRealPilotExperiment } from "@/lib/ai/ai-experiment-runner";
import { recordAiPilotRun } from "@/lib/ai/ai-pilot-run-store";
import { appendAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";

const inputSchema = z.object({
  experimentId: z.string().trim().min(1).max(80),
  promptVersion: z.string().trim().regex(/^v[0-9]{1,4}$/),
  regression: z.boolean().default(false),
}).strict();

async function run(request: Request, input: z.infer<typeof inputSchema>) {
  const tenant = await requireTenantPermission(request.headers, "ai:pilot:write");
  if (!(await rateLimit(request, "ai-experiment", 10, 600, `${tenant.organizationId}:${tenant.userId}`))) {
    return NextResponse.json({ error: "Limite de execuções do piloto atingido." }, { status: 429 });
  }
  const result = await runRealPilotExperiment({
    experimentId: input.experimentId,
    promptVersion: input.promptVersion,
    useRegressionSetOnly: input.regression,
    organizationId: tenant.organizationId,
  });
  const runId = crypto.randomUUID();
  recordAiPilotRun({
    id: runId,
    organizationId: tenant.organizationId,
    corpusItemIds: result.scorecard?.results.map((item) => item.corpusItemId) ?? [],
  });
  await appendAudit({
    organizationId: tenant.organizationId,
    actorUserId: tenant.userId,
    action: "AI_EXPERIMENT_RUN",
    entityType: "ai_pilot_run",
    entityId: runId,
    previousStateSummary: {},
    nextStateSummary: { corpusItems: result.scorecard?.totalCases ?? 0 },
    metadata: { experimentId: input.experimentId, promptVersion: input.promptVersion },
    requestId: request.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
    source: "AI_EXPERIMENT_API",
  });
  return NextResponse.json({ ...result, runId }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const content = await readJsonBody(req, 4096);
    if (!content.ok) return NextResponse.json({ error: content.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: content.reason === "too_large" ? 413 : 400 });
    const body = inputSchema.safeParse(content.value);
    if (!body.success) return NextResponse.json({ error: "Parâmetros de experimento inválidos." }, { status: 400 });
    return await run(req, body.data);
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível executar o experimento." }, { status: 502 });
  }
}
