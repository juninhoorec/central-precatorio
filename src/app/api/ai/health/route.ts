import { NextResponse } from "next/server";
import { checkOllamaHealth, type AIHealthStatus } from "@/lib/ai/ollama-provider";
import { rateLimit } from "@/lib/rate-limit";
import { requireTenantPermission } from "@/lib/tenant";

export const runtime = "nodejs";

function healthResponse(health: AIHealthStatus) {
  if (process.env.NODE_ENV !== "production") return health;
  return {
    status: health.status,
    model: health.model,
    latencyMs: health.latencyMs,
    lastChecked: health.lastChecked,
    failedPhase: health.failedPhase,
    retryUsed: health.retryUsed,
    coldStart: health.coldStart,
    phases: health.phases,
    ...(health.error ? { error: `Health check failed during ${health.failedPhase ?? "unknown"} phase` } : {}),
  };
}

export async function GET(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    const refresh = new URL(request.url).searchParams.get("refresh") === "true";
    if (refresh) {
      await requireTenantPermission(request.headers, "ai:reconfirm");
      if (!(await rateLimit(request, "ai-health-refresh", 10, 600, `${tenant.organizationId}:${tenant.userId}`))) {
        return NextResponse.json({ error: "Limite de verificações atingido." }, { status: 429 });
      }
    }
    const health = await checkOllamaHealth(undefined, { forceRefresh: refresh });
    return NextResponse.json(healthResponse(health), { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível verificar a disponibilidade de IA." }, { status: 503 });
  }
}
