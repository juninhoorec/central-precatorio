import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { appendAudit } from "@/lib/audit";
import {
  getAutonomousDashboard,
  processAcquisitionCycle,
} from "@/lib/autonomous-acquisition";

export const runtime = "nodejs";
const dashboardQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
  status: z.string().trim().max(64).optional(),
  debtor: z.string().trim().max(200).optional(),
  minValue: z.coerce.number().finite().nonnegative().optional(),
  maxValue: z.coerce.number().finite().nonnegative().optional(),
}).refine((value) => value.minValue === undefined || value.maxValue === undefined || value.minValue <= value.maxValue);

export async function GET(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    const { searchParams } = new URL(request.url);
    const query = dashboardQuerySchema.safeParse({
      page: searchParams.get("page") ?? undefined,
      pageSize: searchParams.get("pageSize") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      debtor: searchParams.get("debtor") ?? undefined,
      minValue: searchParams.get("minValue") || undefined,
      maxValue: searchParams.get("maxValue") || undefined,
    });
    if (!query.success) return NextResponse.json({ error: "Filtros inválidos." }, { status: 400 });

    const dashboard = await getAutonomousDashboard(tenant.organizationId, query.data);

    return NextResponse.json(dashboard, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Não foi possível carregar o painel de captação autônoma." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const tenant = await requireTenantPermission(request.headers, "automation:run");
    if (!(await rateLimit(request, "autonomous-cycle", 5, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de ciclos atingido. Aguarde antes de tentar novamente." }, { status: 429 });
    }

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
      metadata: { errorCount: result.errors },
      requestId: request.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
      source: "AUTONOMOUS_WORKER",
    });

    return NextResponse.json(
      { success: true, result },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json({ error: "Falha ao executar o ciclo de captação autônoma." }, { status: 500 });
  }
}
