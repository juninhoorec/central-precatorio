export type CpQueueRecord = {
  valor?: number;
  cpfCnpj?: string;
  titular?: string;
  municipio?: string;
  advogadoNome?: string;
  natureza?: string;
  processoOrigem?: string;
  protocolo?: string;
  oficio1Url?: string;
  oficio2Url?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NextAction = "CONFERIR_CPF" | "CONFIRMAR_CREDOR" | "CONFERIR_OFICIO" | "LOCALIZAR_ADVOGADO" | "ABORDAR_ADVOGADO" | "DESCARTAR";

export function dataQuality(record: CpQueueRecord) {
  const cpf = String(record.cpfCnpj ?? "").replace(/\D/g, "");
  const titular = String(record.titular ?? "").trim();
  const advogado = String(record.advogadoNome ?? "").trim();
  const quality = {
    titular: Boolean(titular) && !/^Credor Titular DEPRE/i.test(titular),
    document: cpf.length === 11 || cpf.length === 14,
    value: Number(record.valor ?? 0) >= 100000,
    municipality: Boolean(record.municipio?.trim()),
    lawyer: Boolean(advogado) && !/habilitado nos autos/i.test(advogado),
    process: Boolean(record.processoOrigem?.trim()),
    documents: Boolean(record.oficio1Url?.trim() || record.oficio2Url?.trim()),
  };
  const complete = Object.values(quality).filter(Boolean).length;
  return { ...quality, complete, total: Object.keys(quality).length, percent: Math.round((complete / Object.keys(quality).length) * 100) };
}

export function nextBestAction(record: CpQueueRecord): NextAction {
  const q = dataQuality(record);
  if (!q.titular) return "CONFIRMAR_CREDOR";
  if (!q.document) return "CONFERIR_CPF";
  if (!q.documents) return "CONFERIR_OFICIO";
  if (!q.lawyer) return "LOCALIZAR_ADVOGADO";
  return "ABORDAR_ADVOGADO";
}

export function priorityScore(record: CpQueueRecord) {
  const q = dataQuality(record);
  let score = 0;
  const value = Number(record.valor ?? 0);
  if (value >= 1_000_000) score += 40; else if (value >= 500_000) score += 25; else if (value >= 200_000) score += 10;
  if (q.document) score += 20;
  if (q.titular) score += 15;
  if (q.lawyer) score += 10;
  if (q.documents) score += 10;
  if (/alimentar/i.test(record.natureza ?? "")) score += 5;
  if (/s[aã]o paulo|guarulhos|campinas/i.test(record.municipio ?? "")) score += 5;
  const ageDays = record.protocolo ? Math.max(0, (Date.now() - new Date(record.protocolo).getTime()) / 864e5) : 0;
  if (ageDays >= 365 * 5) score += 10;
  else if (ageDays >= 365 * 2) score += 5;
  return Math.min(100, score);
}

export function slaState(updatedAt?: string, now = Date.now()) {
  if (!updatedAt) return { level: "SEM_DATA", hours: null as number | null, label: "Sem data de atualização" };
  const hours = Math.max(0, (now - new Date(updatedAt).getTime()) / 36e5);
  if (hours >= 168) return { level: "CRITICO", hours, label: "Parado há 7 dias ou mais" };
  if (hours >= 72) return { level: "ATENCAO", hours, label: "Parado há 3 dias ou mais" };
  if (hours >= 24) return { level: "ALERTA", hours, label: "Parado há 24 horas ou mais" };
  return { level: "NO_PRAZO", hours, label: "Dentro do prazo" };
}
