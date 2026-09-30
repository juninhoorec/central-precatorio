import { NextResponse } from "next/server";
import { requireTenantPermission } from "@/lib/tenant";
import { appendAudit } from "@/lib/audit";
import {
  getAutonomousDashboard,
  processAcquisitionCycle,
} from "@/lib/autonomous-acquisition";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    const { searchParams } = new URL(request.url);

    const page = Number(searchParams.get("page")) || 1;
    const pageSize = Number(searchParams.get("pageSize")) || 30;
    const status = searchParams.get("status") || undefined;
    const debtor = searchParams.get("debtor") || undefined;
    const minValueStr = searchParams.get("minValue");
    const maxValueStr = searchParams.get("maxValue");
    const minValue = minValueStr ? Number(minValueStr) : undefined;
    const maxValue = maxValueStr ? Number(maxValueStr) : undefined;

    const dashboard = await getAutonomousDashboard(tenant.organizationId, {
      page,
      pageSize,
      status,
      debtor,
      minValue,
      maxValue,
    });

    return NextResponse.json(dashboard, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o painel de captação autônoma.",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:write");

    const result = await processAcquisitionCycle({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      limit: 10,
    });

    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "ACQUISITION_JOB_PROCESSED",
      entityType: "acquisition_cycle",
      entityId: result.workerId,
      previousStateSummary: {},
      nextStateSummary: { processed: result.processed, workerId: result.workerId },
      metadata: { errors: result.errors },
      requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
      source: "AUTONOMOUS_WORKER",
    });

    return NextResponse.json(
      { success: true, result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Falha ao executar o ciclo de captação autônoma.",
      },
      { status: 400 },
    );
  }
}
