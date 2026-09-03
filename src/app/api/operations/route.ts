import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { requireTenantPermission } from "@/lib/tenant";
import { appendAudit } from "@/lib/audit";
import {
  createOperation,
  createOperationSchema,
  getOperation,
  listOperations,
  operationSchema,
  updateOperation,
} from "@/lib/operations";

export const runtime = "nodejs";
const MAX_BODY_BYTES = 250 * 1024;

function mutationIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin) && origin === new URL(request.url).origin;
}

function isJson(request: Request) {
  return request.headers
    .get("content-type")
    ?.toLowerCase()
    .startsWith("application/json");
}

async function readBody(request: Request) {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return { tooLarge: true as const };
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES)
    return { tooLarge: true as const };
  try {
    return { value: JSON.parse(text) as unknown, tooLarge: false as const };
  } catch {
    return { value: null, tooLarge: false as const };
  }
}

function failure(error: unknown) {
  if (error instanceof Response) return error;
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Dados da operação inválidos.", issues: error.issues },
      { status: 400 },
    );
  if (error instanceof Error && error.message.startsWith("INVALID_WORKFLOW_TRANSITION:"))
    return NextResponse.json({code:"CONFLICT",error:error.message.slice("INVALID_WORKFLOW_TRANSITION:".length)},{status:409});
  if (error instanceof Error && error.message === "INVALID_INITIAL_WORKFLOW_STAGE")
    return NextResponse.json({code:"VALIDATION_FAILED",error:"Novas operações devem começar na triagem inicial."},{status:400});
  console.error("Operations API failure", error);
  return NextResponse.json(
    { error: "Não foi possível concluir a operação no momento." },
    { status: 500 },
  );
}

export async function GET(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers,"operation:read");
    return NextResponse.json({ operations: await listOperations(undefined, tenant.organizationId) }, {headers:{"cache-control":"no-store"}});
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  if (!isJson(request))
    return NextResponse.json(
      { error: "Content-Type deve ser application/json." },
      { status: 415 },
    );
  if (!mutationIsSameOrigin(request))
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  try {
    const tenant = await requireTenantPermission(request.headers,"operation:write");
    const body = await readBody(request);
    if (body.tooLarge)
      return NextResponse.json({ error: "Payload excede 250 KB." }, { status: 413 });
    const input = createOperationSchema.parse(body.value);
    const operation=await createOperation(input, undefined, tenant.organizationId, tenant.userId);
    await appendAudit({organizationId:tenant.organizationId,actorUserId:tenant.userId,action:"OPPORTUNITY_CREATED",entityType:"opportunity",entityId:operation.id,previousStateSummary:{},nextStateSummary:{stage:operation.workflow.stage,isDemo:operation.isDemo},metadata:{},requestId:request.headers.get("x-request-id")||crypto.randomUUID(),source:"OPERATIONS_API"});
    return NextResponse.json({ operation },{ status: 201 });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(request: Request) {
  if (!isJson(request))
    return NextResponse.json(
      { error: "Content-Type deve ser application/json." },
      { status: 415 },
    );
  if (!mutationIsSameOrigin(request))
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  try {
    const tenant = await requireTenantPermission(request.headers,"operation:read");
    const body = await readBody(request);
    if (body.tooLarge)
      return NextResponse.json({ error: "Payload excede 250 KB." }, { status: 413 });
    const input = operationSchema.parse(body.value);
    const previous=await getOperation(input.id,undefined,tenant.organizationId);
    if(!previous)return NextResponse.json({code:"NOT_FOUND",error:"Operação não encontrada."},{status:404});
    const legalChanged=JSON.stringify(previous.workflow.legalReviews)!==JSON.stringify(input.workflow.legalReviews)||previous.workflow.legalStatus!==input.workflow.legalStatus;
    if(legalChanged){
      await requireTenantPermission(request.headers,"legal:review");
      const nonLegalInput=structuredClone(input),nonLegalPrevious=structuredClone(previous);
      nonLegalInput.workflow.legalReviews=nonLegalPrevious.workflow.legalReviews;nonLegalInput.workflow.legalStatus=nonLegalPrevious.workflow.legalStatus;
      nonLegalInput.version=nonLegalPrevious.version;nonLegalInput.history=nonLegalPrevious.history;
      if(JSON.stringify(nonLegalInput)!==JSON.stringify(nonLegalPrevious))return NextResponse.json({code:"FORBIDDEN",error:"A revisão jurídica não pode alterar outros campos da oportunidade."},{status:403});
    }else await requireTenantPermission(request.headers,"operation:write");
    const result = await updateOperation(input, undefined, tenant.organizationId, tenant.userId);
    if (result.status === "not_found")
      return NextResponse.json({ error: "Operação não encontrada." }, { status: 404 });
    if (result.status === "conflict")
      return NextResponse.json(
        {
          error: "A operação foi alterada por outro usuário.",
          operation: result.operation,
        },
        { status: 409 },
      );
    const stageChanged=previous.workflow.stage!==result.operation.workflow.stage;
    let action:"OPPORTUNITY_STATUS_CHANGED"|"OPPORTUNITY_UPDATED"|"LEGAL_REQUEST_CREATED"|"LEGAL_REVIEW_SUBMITTED"|"PRICING_CREATED"|"OFFER_CREATED"|"OFFER_UPDATED"|"OFFER_ACCEPTED"|"OFFER_REJECTED"|"CESSION_STATUS_CHANGED"|"MONITORING_EVENT_CREATED"=stageChanged?"OPPORTUNITY_STATUS_CHANGED":"OPPORTUNITY_UPDATED";
    if(result.operation.workflow.legalReviews.length>previous.workflow.legalReviews.length)action=result.operation.workflow.legalReviews.at(-1)?.status==="PENDING"?"LEGAL_REQUEST_CREATED":"LEGAL_REVIEW_SUBMITTED";
    else if(result.operation.workflow.pricingScenarios.length>previous.workflow.pricingScenarios.length)action="PRICING_CREATED";
    else if(result.operation.workflow.negotiations.length>previous.workflow.negotiations.length){const type=result.operation.workflow.negotiations.at(-1)?.type;action=type==="ACCEPTED"?"OFFER_ACCEPTED":type==="REJECTED"?"OFFER_REJECTED":"OFFER_CREATED"}
    else if(result.operation.workflow.cessionStatus!==previous.workflow.cessionStatus)action="CESSION_STATUS_CHANGED";
    else if(result.operation.workflow.monitoring.length>previous.workflow.monitoring.length)action="MONITORING_EVENT_CREATED";
    await appendAudit({organizationId:tenant.organizationId,actorUserId:tenant.userId,action,entityType:"opportunity",entityId:result.operation.id,previousStateSummary:{stage:previous.workflow.stage,version:previous.version},nextStateSummary:{stage:result.operation.workflow.stage,version:result.operation.version},metadata:{legalChanged},requestId:request.headers.get("x-request-id")||crypto.randomUUID(),source:"OPERATIONS_API"});
    return NextResponse.json({ operation: result.operation });
  } catch (error) {
    return failure(error);
  }
}
