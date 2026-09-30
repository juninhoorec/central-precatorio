import { NextResponse } from "next/server";
import { executeAiReconfirmation } from "@/lib/ai-reconfirmation";
import { requireTenantPermission } from "@/lib/tenant";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> },
) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
    }
    const tenant = await requireTenantPermission(request.headers, "operation:write");
    await requireTenantPermission(request.headers, "document:read");
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
