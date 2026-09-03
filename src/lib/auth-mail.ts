import { createClient } from "@libsql/client";
const db=createClient({url:process.env.DATABASE_URL||"file:central-precatorios.db",authToken:process.env.DATABASE_AUTH_TOKEN});
export type AuthMailKind="VERIFY_EMAIL"|"RESET_PASSWORD"|"TWO_FACTOR";
export async function deliverAuthMail(input:{to:string;url:string;kind:AuthMailKind}){
  const webhook=process.env.AUTH_EMAIL_WEBHOOK_URL,secret=process.env.AUTH_EMAIL_WEBHOOK_SECRET;
  if(webhook){const response=await fetch(webhook,{method:"POST",headers:{"content-type":"application/json",...(secret?{"authorization":`Bearer ${secret}`}:{})},body:JSON.stringify({to:input.to,kind:input.kind,url:input.url})});if(!response.ok)throw new Error("AUTH_EMAIL_DELIVERY_FAILED");return}
  if(process.env.NODE_ENV==="production")throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  await db.execute("CREATE TABLE IF NOT EXISTS auth_mail_outbox (id TEXT PRIMARY KEY,recipient TEXT NOT NULL,kind TEXT NOT NULL,url TEXT NOT NULL,created_at TEXT NOT NULL,consumed_at TEXT NOT NULL DEFAULT '')");
  await db.execute({sql:"INSERT INTO auth_mail_outbox (id,recipient,kind,url,created_at,consumed_at) VALUES (?,?,?,?,?,?)",args:[crypto.randomUUID(),input.to,input.kind,input.url,new Date().toISOString(),""]});
}

export const mfaModes=["OFF","OPTIONAL","REQUIRED_FOR_PRIVILEGED","REQUIRED_FOR_ALL"] as const;
export type MfaMode=(typeof mfaModes)[number];
export function getMfaMode():MfaMode{const value=process.env.AUTH_MFA_MODE||"OPTIONAL";return mfaModes.includes(value as MfaMode)?value as MfaMode:"OPTIONAL"}
export function isMfaRequired(mode:MfaMode,role:string){return mode==="REQUIRED_FOR_ALL"||(mode==="REQUIRED_FOR_PRIVILEGED"&&["owner","admin","platform_admin"].includes(role.toLowerCase()))}
