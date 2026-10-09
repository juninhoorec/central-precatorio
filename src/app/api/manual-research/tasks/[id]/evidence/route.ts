import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { z } from "zod";
import { getManualResearchTask, submitManualEvidence } from "@/lib/manual-research";
import { isOfficialSourceUrl } from "@/lib/acquisition-sources";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";
import { rateLimit } from "@/lib/rate-limit";
import { createDatabaseClient } from "@/lib/database-config";

const paramsSchema = z.object({ id: z.uuid() });
const bodySchema = z.object({
  officialUrl: z.string().url().max(2048).refine(isOfficialSourceUrl),
  documentIdentifier: z.string().trim().min(1).max(200),
  documentReference: z.string().trim().min(1).max(500),
  documentDate: z.string().min(4).max(50).refine((value) => !Number.isNaN(Date.parse(value))),
  evidenceNotes: z.string().trim().min(1).max(2000),
  rawExcerpt: z.string().max(12000).optional(),
}).strict();

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireSameOrigin(req);
    const tenant = await requireTenantPermission(req.headers, "task:write");
    await requireTenantPermission(req.headers, "document:upload");
    if (!(await rateLimit(req, "manual-evidence-submit", 20, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de submissões de evidência atingido." }, { status: 429 });
    }
    const parsedParams = paramsSchema.safeParse(await params);
    if (!parsedParams.success) return NextResponse.json({ error: "Tarefa inválida." }, { status: 400 });
    const bodyContent = await readJsonBody(req, 20 * 1024);
    if (!bodyContent.ok) return NextResponse.json({ error: bodyContent.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: bodyContent.reason === "too_large" ? 413 : 400 });
    const body = bodySchema.safeParse(bodyContent.value);
    if (!body.success) return NextResponse.json({ error: "Dados de evidência inválidos." }, { status: 400 });

    const db = createDatabaseClient();
    const task = await getManualResearchTask(parsedParams.data.id, tenant.organizationId, db);
    if (!task) return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });

    const result = await submitManualEvidence({
      ...body.data,
      taskId: task.id,
      organizationId: tenant.organizationId,
      operationId: task.operationId,
      depre: task.depre,
      source: task.source,
      actorUserId: tenant.userId,
    }, db);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    if (error instanceof Error && error.message === "MANUAL_EVIDENCE_OFFICIAL_URL_REQUIRED") {
      return NextResponse.json({ error: "Informe uma URL HTTPS de fonte oficial permitida." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "MANUAL_TASK_NOT_FOUND_OR_WRONG_TENANT") {
      return NextResponse.json({ error: "Tarefa não encontrada." }, { status: 404 });
    }
    return NextResponse.json({ error: "Não foi possível registrar a evidência." }, { status: 500 });
  }
}
