import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { z } from "zod";
import { manualTaskCompletionReasons, manualTaskStatuses, updateManualTaskStatus } from "@/lib/manual-research";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";
import { rateLimit } from "@/lib/rate-limit";
import { createDatabaseClient } from "@/lib/database-config";

const paramsSchema = z.object({ id: z.uuid() });
const manualCompletionReasons = manualTaskCompletionReasons.filter((reason) => reason !== "EVIDENCE_SUBMITTED");
const bodySchema = z.object({
  status: z.enum(manualTaskStatuses),
  completedReason: z.enum(manualCompletionReasons).optional(),
}).strict();

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const tenant = await requireTenantPermission(req.headers, "task:write");
    if (!(await rateLimit(req, "manual-task-status", 60, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de atualizações de tarefas atingido." }, { status: 429 });
    }
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
    const bodyContent = await readJsonBody(req, 4096);
    if (!bodyContent.ok) return NextResponse.json({ error: bodyContent.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: bodyContent.reason === "too_large" ? 413 : 400 });
    const body = bodySchema.safeParse(bodyContent.value);
    if (!body.success) return NextResponse.json({ error: "Dados de atualização inválidos." }, { status: 400 });

    const db = createDatabaseClient();
    const task = await updateManualTaskStatus(
      parsedParams.data.id,
      tenant.organizationId,
      body.data.status,
      tenant.userId,
      body.data.completedReason,
      db,
    );
    return NextResponse.json({ task }, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "MANUAL_TASK_NOT_FOUND_OR_WRONG_TENANT") {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "MANUAL_TASK_COMPLETED_REASON_REQUIRED") {
      return NextResponse.json({ error: "Informe o motivo da conclusão." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("MANUAL_TASK_TERMINAL_STATE:")) {
      return NextResponse.json({ error: "Tarefa encerrada não pode ser alterada." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível atualizar a tarefa." }, { status: 500 });
  }
}
