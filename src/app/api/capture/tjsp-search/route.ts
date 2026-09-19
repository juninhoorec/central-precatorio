import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantPermission } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { recordSourceEvent } from "@/lib/capture-imports";

export const runtime="nodejs";
const schema=z.object({kind:z.enum(["precatorio","processo","parte","advogado","oab"]),query:z.string().trim().min(2).max(120)}).strict();
const routeByKind={precatorio:"precatorio",processo:"numproc",parte:"nmparte",advogado:"nmadvogado",oab:"numoab"} as const;
export async function POST(request:Request){let tenant:{organizationId:string;userId:string}|null=null;
 try{
  tenant=await requireTenantPermission(request.headers,"operation:read");
  if(request.headers.get("origin")!==new URL(request.url).origin)return NextResponse.json({error:"Origem não autorizada."},{status:403});
  if(!await rateLimit(request,"tjsp-capture",12,600))return NextResponse.json({error:"Limite temporário de buscas atingido."},{status:429});
  const input=schema.parse(await request.json());
  const path=routeByKind[input.kind],query=encodeURIComponent(input.query);
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  let response:Response;
  try{response=await fetch(`https://api.tjsp.jus.br/processo/cpopg/search/${path}/${query}`,{headers:{accept:"application/json"},signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timeout)}
  if(!response.ok)return NextResponse.json({error:"A consulta pública do TJSP está indisponível.",sourceStatus:response.status},{status:502});
  const data=await response.json(),results=Array.isArray(data)?data.slice(0,100):[];
  await recordSourceEvent({organizationId:tenant.organizationId,sourceId:"tjsp-process-search",success:true,records:results.length,userId:tenant.userId});return NextResponse.json({source:"API pública de consulta processual · TJSP",sourceUrl:"https://www.tjsp.jus.br/Processos/Consulta/",consultedAt:new Date().toISOString(),queryKind:input.kind,results,notice:"Resultado processual público, sujeito a atualização e conferência no TJSP. Esta busca não fornece saldo do precatório, valor atualizado nem canal pessoal de contato."},{headers:{"cache-control":"no-store"}});
 }catch(error){if(tenant){const message=error instanceof Error?error.message:"Falha de conexão";await recordSourceEvent({organizationId:tenant.organizationId,sourceId:"tjsp-process-search",success:false,records:0,error:message.slice(0,500),userId:tenant.userId}).catch(()=>{})}if(error instanceof Response)return error;if(error instanceof z.ZodError)return NextResponse.json({error:"Informe tipo e termo de busca válidos."},{status:400});return NextResponse.json({error:"Não foi possível concluir a consulta ao TJSP."},{status:502})}
}
