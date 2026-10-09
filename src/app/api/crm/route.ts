import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { appendAudit } from "@/lib/audit";
import { changeCrmStage, createCrmActivity, createCrmRecord, createCrmTask, getCrmRecord, listCrmRecords } from "@/lib/crm-service";
import { getOperation } from "@/lib/operations";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-validation";
export const runtime = "nodejs";
const stage = z.enum(["NEW", "QUALIFICATION", "CONTACT_PENDING", "CONTACTED", "FOLLOW_UP", "NEGOTIATION", "WON", "LOST", "ON_HOLD"]);
export async function GET(request: Request) { try { const tenant = await requireTenantPermission(request.headers, "crm:read"); const id = new URL(request.url).searchParams.get("id"); return NextResponse.json(id ? await getCrmRecord(id, tenant.organizationId) : await listCrmRecords(tenant.organizationId)); } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: "Não foi possível consultar o CRM." }, { status: 500 }); } }
export async function POST(request: Request) {
	try {
		requireSameOrigin(request);
		if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
			return NextResponse.json({ error: "Content-Type deve ser application/json." }, { status: 415 });
		}
		const tenant = await requireTenantPermission(request.headers, "crm:write");
		if (!(await rateLimit(request, "crm-write", 40, 600, `${tenant.organizationId}:${tenant.userId}`))) {
			return NextResponse.json({ error: "Limite de alterações do CRM atingido." }, { status: 429 });
		}
		const content = await readJsonBody(request, 16 * 1024);
		if (!content.ok) return NextResponse.json({ error: content.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: content.reason === "too_large" ? 413 : 400 });
		const envelope = z.object({ action: z.enum(["create", "stage", "task", "activity"]).default("create") }).passthrough().parse(content.value);
		const action = envelope.action;
		const body = content.value as Record<string, unknown>;
		let id = "";
		let requestedStage: z.infer<typeof stage> | null = null;
		let previousRecord: Awaited<ReturnType<typeof getCrmRecord>> = null;
		let operationId: string | undefined;
		let result: unknown;

		if (action === "stage") {
			const input = z.object({ action: z.literal("stage"), id: z.uuid(), stage, reason: z.string().trim().max(500).default("") }).strict().parse(content.value);
			id = input.id;
			requestedStage = input.stage;
			const current = await getCrmRecord(id, tenant.organizationId);
			if (!current) return NextResponse.json({ error: "Registro CRM não encontrado." }, { status: 404 });
			previousRecord = current;
			result = await changeCrmStage(id, tenant.organizationId, requestedStage, tenant.userId, input.reason);
		} else if (action === "task") {
			const input = z.object({ action: z.literal("task"), crmId: z.uuid(), title: z.string().trim().min(1).max(160), description: z.string().trim().max(2000).default(""), dueAt: z.iso.datetime().nullable().optional(), priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"), idempotencyKey: z.string().trim().min(1).max(160).optional() }).strict().parse(content.value);
			id = crypto.randomUUID();
			result = await createCrmTask({ id, organizationId: tenant.organizationId, crmId: input.crmId, title: input.title, description: input.description, dueAt: input.dueAt || null, status: "OPEN", priority: input.priority, assigneeId: tenant.userId, completedAt: null, idempotencyKey: input.idempotencyKey || id });
		} else if (action === "activity") {
			const input = z.object({ action: z.literal("activity"), crmId: z.uuid(), type: z.enum(["CALL_ATTEMPTED", "CALL_COMPLETED", "EMAIL_MANUAL", "MEETING", "FOLLOW_UP", "DOCUMENT_REVIEW", "NOTE"]), notes: z.string().trim().max(3000).default("") }).strict().parse(content.value);
			id = crypto.randomUUID();
			result = await createCrmActivity({ id, organizationId: tenant.organizationId, crmId: input.crmId, actorId: tenant.userId, type: input.type, notes: input.notes, occurredAt: new Date().toISOString() });
		} else {
			const input = z.object({ action: z.literal("create").default("create"), operationId: z.uuid(), opportunityId: z.uuid().nullable().optional(), contactIds: z.array(z.uuid()).max(100).default([]) }).strict().parse(content.value);
			id = crypto.randomUUID();
			operationId = input.operationId;
			if (!await getOperation(operationId, undefined, tenant.organizationId)) return NextResponse.json({ error: "Operação não encontrada." }, { status: 404 });
			result = await createCrmRecord({ id, organizationId: tenant.organizationId, operationId, opportunityId: input.opportunityId || null, contactIds: input.contactIds, stage: "NEW", nextActionAt: null });
		}

		const audit = action === "create" ? { action: "CRM_RECORD_CREATED" as const, entityType: "crm_record" }
			: action === "stage" ? { action: "CRM_STAGE_CHANGED" as const, entityType: "crm_record" }
			: action === "task" ? { action: "CRM_TASK_CREATED" as const, entityType: "crm_task" }
			: { action: "CRM_ACTIVITY_RECORDED" as const, entityType: "crm_activity" };
		let previousStateSummary: Record<string, string | number | boolean | null> = {};
		let nextStateSummary: Record<string, string | number | boolean | null>;
		if (action === "stage") {
			previousStateSummary = { stage: previousRecord?.stage ?? null };
			nextStateSummary = { previousStage: previousRecord?.stage ?? null, stage: requestedStage! };
		} else if (action === "create") {
			nextStateSummary = { operationId: operationId ?? "", stage: "NEW" };
		} else if (action === "task") {
			nextStateSummary = { crmId: String(body.crmId), taskTitle: String(body.title), status: "OPEN" };
		} else {
			nextStateSummary = { crmId: String(body.crmId), activityType: String(body.type) };
		}
		await appendAudit({ organizationId: tenant.organizationId, actorUserId: tenant.userId, action: audit.action, entityType: audit.entityType, entityId: id, previousStateSummary, nextStateSummary, metadata: {}, requestId: request.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(), source: "CRM_API" });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		if (error instanceof Response) return error;
		return NextResponse.json({ error: "Não foi possível salvar no CRM." }, { status: 400 });
	}
}
