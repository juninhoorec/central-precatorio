import { createHash } from "node:crypto";
import { createClient, type Client, type Transaction } from "@libsql/client";
import { z } from "zod";

const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
export const auditActions = ["LOGIN","LOGOUT","LOGIN_FAILED","PASSWORD_CHANGED","MFA_CHANGED","ORGANIZATION_MEMBERSHIP_CHANGED","ROLE_CHANGED","LEAD_CREATED","OPPORTUNITY_CREATED","OPPORTUNITY_STATUS_CHANGED","OPPORTUNITY_UPDATED","DOCUMENT_UPLOADED","DOCUMENT_DOWNLOADED","DOCUMENT_DELETED","DOCUMENT_STATUS_CHANGED","LEGAL_REQUEST_CREATED","LEGAL_REVIEW_SUBMITTED","PRICING_CREATED","OFFER_CREATED","OFFER_UPDATED","OFFER_ACCEPTED","OFFER_REJECTED","CESSION_STATUS_CHANGED","MONITORING_EVENT_CREATED","EXPORT_CREATED","INTEGRATION_CHANGED","DEMO_LOADED","DEMO_RESET"] as const;

const summary = z.record(z.string(), z.union([z.string(),z.number(),z.boolean(),z.null()])).default({});
export const auditInputSchema = z.object({
  organizationId:z.string().min(1).max(160), actorUserId:z.string().min(1).max(160), action:z.enum(auditActions),
  entityType:z.string().min(1).max(80), entityId:z.string().min(1).max(160),
  previousStateSummary:summary, nextStateSummary:summary, metadata:summary,
  requestId:z.string().max(160).default(""), source:z.string().max(80).default("CP_WEB"),
}).strict();
export type AuditInput=z.infer<typeof auditInputSchema>;

export async function initializeAudit(client:Client=db){
  await client.execute(`CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, actor_user_id TEXT NOT NULL, action TEXT NOT NULL,
    entity_type TEXT NOT NULL, entity_id TEXT NOT NULL, timestamp TEXT NOT NULL,
    previous_state_summary TEXT NOT NULL, next_state_summary TEXT NOT NULL, metadata TEXT NOT NULL,
    request_id TEXT NOT NULL, source TEXT NOT NULL, previous_event_hash TEXT NOT NULL, event_hash TEXT NOT NULL UNIQUE
  )`);
  await client.execute("CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_logs(organization_id,entity_type,entity_id,timestamp DESC)");
  await client.execute("CREATE INDEX IF NOT EXISTS audit_org_idx ON audit_logs(organization_id,timestamp DESC)");
}

function stable(value:unknown):string {
  if(value===null||typeof value!=="object") return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stable(v)}`).join(",")}}`;
}

export async function appendAudit(input:AuditInput, client:Client|Transaction=db){
  const parsed=auditInputSchema.parse(input); await initializeAudit(client as Client);
  const last=await client.execute({sql:"SELECT event_hash FROM audit_logs WHERE organization_id=? ORDER BY rowid DESC LIMIT 1",args:[parsed.organizationId]});
  const previousEventHash=String(last.rows[0]?.event_hash||""); const timestamp=new Date().toISOString(); const id=crypto.randomUUID();
  const payload={id,...parsed,timestamp,previousEventHash};
  const eventHash=createHash("sha256").update(stable(payload)).digest("hex");
  await client.execute({sql:`INSERT INTO audit_logs (id,organization_id,actor_user_id,action,entity_type,entity_id,timestamp,previous_state_summary,next_state_summary,metadata,request_id,source,previous_event_hash,event_hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,args:[id,parsed.organizationId,parsed.actorUserId,parsed.action,parsed.entityType,parsed.entityId,timestamp,stable(parsed.previousStateSummary),stable(parsed.nextStateSummary),stable(parsed.metadata),parsed.requestId,parsed.source,previousEventHash,eventHash]});
  return {id,timestamp,previousEventHash,eventHash};
}

export async function listAudit(organizationId:string, entityType?:string, entityId?:string, client:Client=db){
  await initializeAudit(client); const where=["organization_id=?"],args:(string|number)[]=[organizationId];
  if(entityType){where.push("entity_type=?");args.push(entityType)} if(entityId){where.push("entity_id=?");args.push(entityId)}
  const result=await client.execute({sql:`SELECT id,actor_user_id,action,entity_type,entity_id,timestamp,previous_state_summary,next_state_summary,metadata,request_id,source,previous_event_hash,event_hash FROM audit_logs WHERE ${where.join(" AND ")} ORDER BY rowid DESC LIMIT 300`,args});
  return result.rows.map(r=>({id:String(r.id),actorUserId:String(r.actor_user_id),action:String(r.action),entityType:String(r.entity_type),entityId:String(r.entity_id),timestamp:String(r.timestamp),previousStateSummary:JSON.parse(String(r.previous_state_summary)),nextStateSummary:JSON.parse(String(r.next_state_summary)),metadata:JSON.parse(String(r.metadata)),requestId:String(r.request_id),source:String(r.source),previousEventHash:String(r.previous_event_hash),eventHash:String(r.event_hash)}));
}

export async function verifyAuditChain(organizationId:string, client:Client=db){
  await initializeAudit(client); const result=await client.execute({sql:"SELECT * FROM audit_logs WHERE organization_id=? ORDER BY rowid ASC",args:[organizationId]}); let previous="";
  for(const r of result.rows){const payload={id:String(r.id),organizationId:String(r.organization_id),actorUserId:String(r.actor_user_id),action:String(r.action),entityType:String(r.entity_type),entityId:String(r.entity_id),previousStateSummary:JSON.parse(String(r.previous_state_summary)),nextStateSummary:JSON.parse(String(r.next_state_summary)),metadata:JSON.parse(String(r.metadata)),requestId:String(r.request_id),source:String(r.source),timestamp:String(r.timestamp),previousEventHash:String(r.previous_event_hash)};const hash=createHash("sha256").update(stable(payload)).digest("hex");if(String(r.previous_event_hash)!==previous||String(r.event_hash)!==hash)return false;previous=String(r.event_hash)} return true;
}
