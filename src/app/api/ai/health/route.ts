import { NextResponse } from "next/server";
import { checkOllamaHealth, type AIHealthStatus } from "@/lib/ai/ollama-provider";

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
  const refresh = new URL(request.url).searchParams.get("refresh") === "true";
  const health = await checkOllamaHealth(undefined, { forceRefresh: refresh });
  return NextResponse.json(healthResponse(health), { headers: { "cache-control": "no-store" } });
}
