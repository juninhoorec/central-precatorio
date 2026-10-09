import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { z } from "zod";
import { listManualResearchTasks } from "@/lib/manual-research";
import { requireTenantPermission } from "@/lib/tenant";
import { createDatabaseClient } from "@/lib/database-config";

const statusSchema = z.enum(["OPEN", "IN_PROGRESS", "WAITING_EXTERNAL", "BLOCKED", "COMPLETED", "CANCELLED"]);

export async function GET(req: Request) {
  try {
    const tenant = await requireTenantPermission(req.headers, "operation:read");
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status");
    const parsedStatus = statusParam === null ? undefined : statusSchema.safeParse(statusParam);
    if (parsedStatus && !parsedStatus.success) {
      return NextResponse.json({ error: "Filtro de status inválido." }, { status: 400 });
    }

    const db = createDatabaseClient();

    const tasks = await listManualResearchTasks(tenant.organizationId, { status: parsedStatus?.data }, db);
    return NextResponse.json({ tasks }, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível consultar as tarefas." }, { status: 500 });
  }
}
