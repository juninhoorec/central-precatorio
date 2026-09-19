import { NextResponse } from "next/server";
import { requireTenantPermission } from "@/lib/tenant";
import { listImportBatches } from "@/lib/capture-imports";
export const runtime="nodejs";
export async function GET(request:Request){try{const tenant=await requireTenantPermission(request.headers,"operation:read");const batches=await listImportBatches(tenant.organizationId);return NextResponse.json({batches},{headers:{"cache-control":"no-store"}})}catch(e){if(e instanceof Response)return e;return NextResponse.json({error:"Não foi possível carregar o histórico."},{status:500})}}
