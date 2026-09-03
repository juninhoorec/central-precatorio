import OperationsClient from "./operations-client";
import { requireTenant } from "@/lib/tenant";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
export const metadata = { title: "Mesa de operações", description: "Gestão interna de oportunidades, diligência, tarefas e propostas da Central Precatórios.", robots: { index: false, follow: false } };
export default async function Page(){
  try { await requireTenant(await headers()); }
  catch(error) { if(error instanceof Response && [401,403,503].includes(error.status)) redirect("/conta"); throw error; }
  return <OperationsClient/>;
}
