import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantPermission } from "@/lib/tenant";
import { appendAudit } from "@/lib/audit";
import { changeCrmStage, createCrmActivity, createCrmRecord, createCrmTask, getCrmRecord, listCrmRecords } from "@/lib/crm-service";
import { getOperation } from "@/lib/operations";
export const runtime = "nodejs";
const stage = z.enum(["NEW", "QUALIFICATION", "CONTACT_PENDING", "CONTACTED", "FOLLOW_UP", "NEGOTIATION", "WON", "LOST", "ON_HOLD"]);
export async function GET(request: Request) { try { const tenant = await requireTenantPermission(request.headers, "crm:read"); const id = new URL(request.url).searchParams.get("id"); return NextResponse.json(id ? await getCrmRecord(id, tenant.organizationId) : await listCrmRecords(tenant.organizationId)); } catch (error) { if (error instanceof Response) return error; return NextResponse.json({ error: "Não foi possível consultar o CRM." }, { status: 500 }); } }
export async function POST(request: Request) {
	try {
		const tenant = await requireTenantPermission(request.headers, "crm:write");
		const body = await request.json() as Record<string, unknown>;
		const action = z.enum(["create", "stage", "task", "activity"]).parse(body.action || "create");
		const id = String(body.id || "");
		const requestedStage = action === "stage" ? stage.parse(body.stage) : null;
		const previousRecord = action === "stage" ? await getCrmRecord(id, tenant.organizationId) : null;
		let operationId: string | undefined;
		let result: unknown;

		if (action === "stage") {
			result = await changeCrmStage(id, tenant.organizationId, requestedStage!, tenant.userId, String(body.reason || ""));
		} else if (action === "task") {
			result = await createCrmTask({ id, organizationId: tenant.organizationId, crmId: String(body.crmId), title: String(body.title), description: String(body.description || ""), dueAt: body.dueAt ? String(body.dueAt) : null, status: "OPEN", priority: body.priority === "HIGH" || body.priority === "LOW" ? body.priority : "MEDIUM", assigneeId: body.assigneeId ? String(body.assigneeId) : null, completedAt: null, idempotencyKey: String(body.idempotencyKey || id) });
		} else if (action === "activity") {
			const type = z.enum(["CALL_ATTEMPTED", "CALL_COMPLETED", "EMAIL_MANUAL", "MEETING", "FOLLOW_UP", "DOCUMENT_REVIEW", "NOTE"]).parse(body.type);
			result = await createCrmActivity({ id, organizationId: tenant.organizationId, crmId: String(body.crmId), actorId: tenant.userId, type, notes: String(body.notes || ""), occurredAt: new Date().toISOString() });
		} else {
			operationId = String(body.operationId || "");
			if (!await getOperation(operationId, undefined, tenant.organizationId)) return NextResponse.json({ error: "Operação não encontrada." }, { status: 404 });
			result = await createCrmRecord({ id, organizationId: tenant.organizationId, operationId, opportunityId: body.opportunityId ? String(body.opportunityId) : null, contactIds: Array.isArray(body.contactIds) ? body.contactIds.map(String) : [], stage: "NEW", nextActionAt: null });
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
		await appendAudit({ organizationId: tenant.organizationId, actorUserId: tenant.userId, action: audit.action, entityType: audit.entityType, entityId: id, previousStateSummary, nextStateSummary, metadata: {}, requestId: crypto.randomUUID(), source: "CRM_API" });
		return NextResponse.json(result, { status: 201 });
	} catch (error) {
		if (error instanceof Response) return error;
		return NextResponse.json({ error: "Não foi possível salvar no CRM." }, { status: 400 });
	}
}
