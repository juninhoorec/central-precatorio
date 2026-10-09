import { NextResponse } from "next/server";
import { executeAiReconfirmation } from "@/lib/ai-reconfirmation";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  try {
    requireSameOrigin(request);
    const tenant = await requireTenantPermission(request.headers, "ai:reconfirm");
    await requireTenantPermission(request.headers, "document:read");
    if (!(await rateLimit(request, "ai-reconfirmation", 5, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de reconfirmações atingido." }, { status: 429 });
    }
    const { id, runId } = await params;
    const attempt = await executeAiReconfirmation({
      organizationId: tenant.organizationId,
      operationId: id,
      runId,
      actorUserId: tenant.userId,
    });
    return NextResponse.json({ attempt }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "RECONFIRMATION_RUN_NOT_FOUND") {
      return NextResponse.json({ error: "Tentativa não encontrada para esta operação." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "RECONFIRMATION_RUN_NOT_PENDING") {
      return NextResponse.json({ error: "A tentativa não está pendente e não pode ser executada novamente." }, { status: 409 });
    }
    console.error("AI reconfirmation execution failed", error);
    return NextResponse.json({ error: "A tentativa de reconfirmação não pôde ser executada." }, { status: 500 });
  }
}
