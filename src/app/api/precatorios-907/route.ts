import { NextResponse } from "next/server";
import { requireTenantPermission } from "@/lib/tenant";
import { listOperations } from "@/lib/operations";

export const runtime = "nodejs";

function toRecord(operation: Awaited<ReturnType<typeof listOperations>>[number]) {
  const credit = operation.workflow.credit;
  const client = operation.workflow.client;
  return {
    id: operation.id,
    depre: credit.depreReference || credit.precatoryNumber || credit.numeroProcessoDEPRE || operation.process,
    titular: client.name,
    cpfCnpj: client.document || undefined,
    valor: Number(credit.grossAmount || operation.nominal || 0),
    municipio: credit.municipality || operation.debtor,
    devedor: operation.debtor,
    processoOrigem: credit.originProcessNumber || operation.process,
    advogadoNome: credit.legalRepName,
    advogadoOab: credit.legalRepOab,
    advogadoContato: client.phone || client.email || "",
    oficio1Url: "",
    oficio2Url: "",
    cnaUrl: "https://cna.oab.org.br/",
    statusLocalizacao: "DISPONIVEL" as const,
    prioridade: credit.grossAmount >= 1000000 ? 80 : credit.grossAmount >= 500000 ? 60 : 40,
    natureza: credit.nature,
    honorarios: "",
    updatedAt: operation.history.at(-1)?.at,
  };
}

export async function GET(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    const { searchParams } = new URL(request.url);
    const municipio = (searchParams.get("municipio") || "").toLowerCase();
    const search = (searchParams.get("search") || "").toLowerCase().trim();
    const minValor = Number(searchParams.get("minValor") || 100000);
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const pageSize = Math.min(200, Math.max(1, Number(searchParams.get("pageSize") || 50)));
    const operations = await listOperations(undefined, tenant.organizationId);
    const queue = operations.map(toRecord).filter((item) => {
      if (minValor > 0 && item.valor > 0 && item.valor < minValor) return false;
      if (municipio && !`${item.municipio} ${item.devedor}`.toLowerCase().includes(municipio)) return false;
      if (search && ![item.depre, item.titular, item.advogadoNome, item.advogadoOab, item.processoOrigem].join(" ").toLowerCase().includes(search)) return false;
      return true;
    });
    const start = (page - 1) * pageSize;
    return NextResponse.json({ total: operations.length, disponiveis: operations.length, localizados: operations.length, pendentes: 0, page, pageSize, workerActive: false, items: queue.slice(start, start + pageSize), allFilteredCount: queue.length }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    console.error("Fila DEPRE API failure", error);
    return NextResponse.json({ error: "Não foi possível carregar a fila de credores." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    const operations = await listOperations(undefined, tenant.organizationId);
    return NextResponse.json({ success: true, processedCount: 0, unchangedCount: operations.length, message: "Dossiês disponíveis para análise manual.", totalLocalizados: operations.length, totalQueue: operations.length });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível atualizar a fila." }, { status: 500 });
  }
}
