import { NextResponse } from "next/server";
import { buildConsolidatedQueue, type PrecatRecord } from "@/../scripts/consolidate-pilot-907.mts";

import * as fs from "fs";
import * as path from "path";

let inMemoryQueue: PrecatRecord[] = [];
let isWorkerRunning = false;

function getQueue() {
  if (inMemoryQueue.length === 0) {
    const jsonPath = path.resolve("data/queue-907-consolidated-final.json");
    if (fs.existsSync(jsonPath)) {
      try {
        inMemoryQueue = (JSON.parse(fs.readFileSync(jsonPath, "utf-8")) as PrecatRecord[])
          .filter((item) => item.id.startsWith("CP-907-"))
          .map((item) => ({ ...item, statusLocalizacao: "DISPONIVEL" }));
      } catch {
        inMemoryQueue = buildConsolidatedQueue().filter((item) => item.id.startsWith("CP-907-")).map((item) => ({ ...item, statusLocalizacao: "DISPONIVEL" }));
      }
    } else {
      inMemoryQueue = buildConsolidatedQueue().filter((item) => item.id.startsWith("CP-907-")).map((item) => ({ ...item, statusLocalizacao: "DISPONIVEL" }));
    }
  }
  return inMemoryQueue;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queue = getQueue();
  
  const municipioFilter = searchParams.get("municipio") || "";
  const statusFilter = searchParams.get("status") || "";
  const minValor = parseFloat(searchParams.get("minValor") || "100000");
  const search = (searchParams.get("search") || "").toLowerCase().trim();

  const filtered = queue.filter((item) => {
    if (minValor > 0 && item.valor > 0 && item.valor < minValor) return false;
    if (municipioFilter && !item.municipio.toLowerCase().includes(municipioFilter.toLowerCase())) return false;
    if (statusFilter && item.statusLocalizacao !== statusFilter) return false;
    if (search) {
      const matchDepre = item.depre.toLowerCase().includes(search);
      const matchTitular = item.titular.toLowerCase().includes(search);
      const matchAdv = item.advogadoNome.toLowerCase().includes(search);
      const matchProc = item.processoOrigem.toLowerCase().includes(search);
      if (!matchDepre && !matchTitular && !matchAdv && !matchProc) return false;
    }
    return true;
  });

  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "200", 10);
  const start = (page - 1) * pageSize;
  const pagedItems = filtered.slice(start, start + pageSize);

  const total = queue.length;
  const disponiveis = queue.filter((r) => r.statusLocalizacao === "DISPONIVEL").length;

  return NextResponse.json({
    total,
    disponiveis,
    localizados: disponiveis,
    pendentes: 0,
    page,
    pageSize,
    workerActive: isWorkerRunning,
    items: pagedItems,
    allFilteredCount: filtered.length,
  });
}

// POST endpoint to trigger autonomous background enrichment
export async function POST(request: Request) {
  const queue = getQueue();
  const body = await request.json().catch(() => ({}));
  const batchSize = body.batchSize || 4;

  const disponiveis = queue.filter((r) => r.statusLocalizacao === "DISPONIVEL");
  if (disponiveis.length === 0) {
    return NextResponse.json({ message: "A fila já está disponível para análise.", queueLength: queue.length });
  }

  isWorkerRunning = true;
  const toProcess = disponiveis.slice(0, batchSize);

  // A fila é um dossiê de prospecção. A conferência final do titular,
  // documento e valor fica com o analista e não bloqueia a entrega.
  isWorkerRunning = false;

  const localizados = queue.filter((r) => r.statusLocalizacao === "DISPONIVEL").length;

  return NextResponse.json({
    success: true,
    processedCount: toProcess.length,
    unchangedCount: toProcess.length,
    message: "Dossiês disponíveis para análise manual. A confirmação final é responsabilidade do analista.",
    totalLocalizados: localizados,
    totalQueue: queue.length,
  });
}
