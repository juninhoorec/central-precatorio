import { createClient, type Client } from "@libsql/client";
import { z } from "zod";

const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
export const creditorResolutionStates = ["PENDENTE", "CREDOR_IDENTIFICADO", "CREDOR_CORROBORADO", "CREDOR_PARCIALMENTE_IDENTIFICADO", "CREDOR_NÃO_IDENTIFICADO", "POSSÍVEL_CORRESPONDÊNCIA", "CONFLITO_DE_IDENTIDADE", "REVISÃO_HUMANA", "FONTE_INDISPONÍVEL"] as const;
export const creditorRoles = ["CREDOR", "BENEFICIÁRIO", "REQUERENTE", "AUTOR", "ADVOGADO", "DEVEDOR", "HERDEIRO", "CESSIONÁRIO", "OUTRO", "NÃO_IDENTIFICADO"] as const;
export const creditorQueryStates = ["RESULTS_FOUND", "RESULT_ZERO", "ACCESS_FAILED", "REQUIRES_ASSISTED_ACTION"] as const;
export type CreditorResolutionState = typeof creditorResolutionStates[number];
export type CreditorRole = typeof creditorRoles[number];
export type CreditorCandidateInput = z.infer<typeof creditorCandidateSchema>;

const short = z.string().trim().max(500);
export const creditorCandidateSchema = z.object({
  displayName: z.string().trim().min(1).max(240),
  debtorName: z.string().trim().max(240).default(""),
  personType: z.enum(["PERSON", "COMPANY", "ESTATE", "SUCCESSION", "UNKNOWN"]).default("UNKNOWN"),
  role: z.enum(creditorRoles),
  maskedCpf: z.string().trim().max(24).default(""),
  matchedField: z.enum(["numeroProcessoDEPRE", "epes", "originProcessNumber", "precatoryNumber", "name", "cpf", "none"]),
  matchedValue: short,
  evidenceExcerpt: z.string().trim().min(1).max(2000),
  source: short,
  sourceUrl: z.string().url().max(1000),
  sourceReferenceDate: z.union([z.literal(""), z.iso.date()]).default(""),
  sourcePage: z.number().int().positive().nullable().default(null),
  officialRoleConfirmed: z.boolean().default(false),
  currentHolderClaim: z.enum(["CURRENT_HOLDER", "ORIGINAL_CREDITOR", "UNKNOWN"]).default("UNKNOWN"),
}).strict();

export const resolutionInputSchema = z.object({
  operationId: z.string().uuid(),
  idempotencyKey: z.string().trim().min(8).max(160),
  identifiers: z.object({ numeroProcessoDEPRE: short, epes: short, originProcessNumber: short, precatoryNumber: short, debtor: short }).strict(),
  existingCreditorName: z.string().trim().max(240).default(""),
  source: short,
  sourceUrl: z.string().url().max(1000),
  mode: z.enum(["PUBLIC_LOOKUP", "ASSISTED_CAPTURE"]),
  queryKind: z.enum(["PROCESSO_DEPRE", "EPES", "PROCESSO_ORIGINARIO", "PRECATORIO", "PARTES", "CPF"]),
  queryValue: short,
  queryState: z.enum(creditorQueryStates),
  resultCount: z.number().int().nonnegative().max(1000),
  candidates: z.array(creditorCandidateSchema).max(50).default([]),
});

export type CreditorResolution = {
  state: CreditorResolutionState;
  confidence: "ALTA" | "MÉDIA" | "BAIXA" | "NÃO DETERMINADA";
  currentHolderStatus: "CURRENT_HOLDER_CONFIRMED" | "CURRENT_HOLDER_NOT_CONFIRMED" | "POSSIBLE_TRANSFER" | "SUCCESSION_REVIEW" | "UNKNOWN";
  selectedCandidate: CreditorCandidateInput | null;
  explanation: string;
  nextAction: string;
};
export type CreditorResolutionAttempt = CreditorResolution & {
  id: string;
  organizationId: string;
  operationId: string;
  source: string;
  sourceUrl: string;
  mode: "PUBLIC_LOOKUP" | "ASSISTED_CAPTURE";
  queryKind: string;
  queryValue: string;
  queryState: typeof creditorQueryStates[number];
  resultCount: number;
  candidates: CreditorCandidateInput[];
  capturedAt: string;
  actorUserId: string;
};

const norm = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
function exactMatch(candidate: CreditorCandidateInput, identifiers: { numeroProcessoDEPRE: string; epes: string; originProcessNumber: string; precatoryNumber: string; debtor: string }) {
  const value = norm(candidate.matchedValue);
  if (candidate.matchedField === "numeroProcessoDEPRE" && identifiers.numeroProcessoDEPRE && value === norm(identifiers.numeroProcessoDEPRE)) return "DEPRE" as const;
  const debtorMatches = Boolean(identifiers.debtor) && norm(candidate.debtorName) === norm(identifiers.debtor);
  if (candidate.matchedField === "epes" && identifiers.epes && value === norm(identifiers.epes) && debtorMatches) return "EPES" as const;
  if (candidate.matchedField === "originProcessNumber" && identifiers.originProcessNumber && value === norm(identifiers.originProcessNumber) && debtorMatches) return "ORIGIN_PROCESS" as const;
  if (candidate.matchedField === "precatoryNumber" && identifiers.precatoryNumber && value === norm(identifiers.precatoryNumber) && debtorMatches) return "PRECATORY" as const;
  return null;
}
export function resolveCreditor(input: {
  queryState: typeof creditorQueryStates[number];
  resultCount: number;
  candidates: CreditorCandidateInput[];
  previousCandidates?: CreditorCandidateInput[];
  existingCreditorName?: string;
  identifiers: { numeroProcessoDEPRE: string; epes: string; originProcessNumber: string; precatoryNumber: string; debtor: string };
}): CreditorResolution {
  const base: Pick<CreditorResolution, "currentHolderStatus" | "selectedCandidate"> = { currentHolderStatus: "CURRENT_HOLDER_NOT_CONFIRMED", selectedCandidate: null };
  if (input.queryState === "ACCESS_FAILED") return { ...base, state: "FONTE_INDISPONÍVEL", confidence: "NÃO DETERMINADA", explanation: "A consulta pública não pôde ser concluída; isso não informa quem é o credor.", nextAction: "Tentar outra fonte oficial ou captura assistida." };
  if (input.queryState === "REQUIRES_ASSISTED_ACTION") return { ...base, state: "REVISÃO_HUMANA", confidence: "NÃO DETERMINADA", explanation: "A fonte exige uma etapa humana. Nenhuma identidade foi presumida.", nextAction: "Concluir a consulta oficial e registrar o resultado com evidência." };
  if (input.queryState === "RESULT_ZERO" || input.resultCount === 0) return { ...base, state: "CREDOR_NÃO_IDENTIFICADO", confidence: "NÃO DETERMINADA", explanation: "Consulta concluída sem registros retornados. Resultado zero não prova ausência de credor nem de dados.", nextAction: "Registrar o contexto consultado e tentar outra fonte ou captura assistida." };
  if (!input.candidates.length && input.resultCount > 0) return { ...base, state: "REVISÃO_HUMANA", confidence: "NÃO DETERMINADA", explanation: "A fonte retornou registros, mas o formato de partes/papéis ainda não está validado para extração automática.", nextAction: "Inspecionar o resultado oficial e registrar manualmente a parte e seu papel." };
  if (!input.candidates.length) return { ...base, state: "CREDOR_NÃO_IDENTIFICADO", confidence: "NÃO DETERMINADA", explanation: "Nenhum candidato com papel e evidência foi identificado.", nextAction: "Tentar outra fonte oficial ou captura assistida." };

  const verified = input.candidates.map(candidate => ({ candidate, match: exactMatch(candidate, input.identifiers) }));
  const explicitCreditor = verified.filter(item => ["CREDOR", "BENEFICIÁRIO"].includes(item.candidate.role) && item.candidate.officialRoleConfirmed && item.candidate.evidenceExcerpt.length > 0 && item.match);
  const uniqueNames = new Set(explicitCreditor.map(item => norm(item.candidate.displayName)));
  if (uniqueNames.size > 1) return { ...base, state: "CONFLITO_DE_IDENTIDADE", confidence: "BAIXA", explanation: "A mesma combinação de identificadores aponta para mais de uma pessoa explicitamente rotulada como credora/beneficiária. Nenhuma foi escolhida.", nextAction: "Revisar documentos e papéis das partes antes de associar o credor." };
  if (explicitCreditor.length && input.existingCreditorName && !explicitCreditor.some(item => norm(item.candidate.displayName) === norm(input.existingCreditorName!))) return { ...base, state: "CONFLITO_DE_IDENTIDADE", confidence: "BAIXA", explanation: "A fonte identifica uma pessoa diferente do credor já registrado para este lead. Nenhuma identidade foi sobrescrita.", nextAction: "Revisar ambas as fontes e resolver a divergência manualmente." };
  if (explicitCreditor.length) {
    const selectedCandidate = explicitCreditor[0].candidate;
    const corroborated = (input.previousCandidates || []).some(previous => norm(previous.displayName) === norm(selectedCandidate.displayName) && previous.officialRoleConfirmed && previous.sourceUrl !== selectedCandidate.sourceUrl && exactMatch(previous, input.identifiers));
    return { ...base, selectedCandidate, state: corroborated ? "CREDOR_CORROBORADO" : "CREDOR_IDENTIFICADO", confidence: explicitCreditor[0].match === "DEPRE" ? "ALTA" : "MÉDIA", explanation: corroborated ? "Duas fontes oficiais independentes identificam a mesma pessoa e os identificadores coincidem." : `A fonte identifica explicitamente o papel ${selectedCandidate.role}; correspondência ${explicitCreditor[0].match === "DEPRE" ? "exata do Nº Processo DEPRE" : "exata de identificador de apoio"}.`, nextAction: "Manter titularidade atual como não confirmada e revisar evidência antes de abordagem." };
  }
  const attorneyOnly = input.candidates.every(candidate => candidate.role === "ADVOGADO");
  if (attorneyOnly) return { ...base, state: "CREDOR_NÃO_IDENTIFICADO", confidence: "BAIXA", explanation: "A fonte identifica advogado(s), mas advogado não é credor sem evidência explícita dessa relação.", nextAction: "Localizar documento ou consulta que identifique o beneficiário." };
  const explicitParty = verified.find(item => item.match && item.candidate.officialRoleConfirmed);
  if (explicitParty) return { ...base, state: "CREDOR_PARCIALMENTE_IDENTIFICADO", confidence: explicitParty.match === "DEPRE" ? "MÉDIA" : "BAIXA", selectedCandidate: explicitParty.candidate, explanation: `A parte aparece com papel ${explicitParty.candidate.role}, mas a fonte não a identifica explicitamente como credor/beneficiário.`, nextAction: "Revisão humana do papel da parte; não converter automaticamente em credor." };
  return { ...base, state: "POSSÍVEL_CORRESPONDÊNCIA", confidence: "BAIXA", selectedCandidate: input.candidates[0], explanation: "Há candidato(s), mas falta correspondência exata de identificador e papel de credor/beneficiário.", nextAction: "Conferir identificadores e papel em evidência oficial." };
}

export async function initializeCreditorResolution(client: Client = db) {
  await client.execute(`CREATE TABLE IF NOT EXISTS creditor_resolution_attempts(id TEXT PRIMARY KEY,organization_id TEXT NOT NULL,operation_id TEXT NOT NULL,source TEXT NOT NULL,source_url TEXT NOT NULL,mode TEXT NOT NULL,query_kind TEXT NOT NULL,query_value TEXT NOT NULL,query_state TEXT NOT NULL,result_count INTEGER NOT NULL,candidates_json TEXT NOT NULL,resolution_json TEXT NOT NULL,captured_at TEXT NOT NULL,actor_user_id TEXT NOT NULL,idempotency_key TEXT NOT NULL)`);
  await client.execute("CREATE UNIQUE INDEX IF NOT EXISTS creditor_resolution_idempotency_idx ON creditor_resolution_attempts(organization_id,operation_id,idempotency_key)");
  await client.execute("CREATE INDEX IF NOT EXISTS creditor_resolution_history_idx ON creditor_resolution_attempts(organization_id,operation_id,captured_at DESC)");
}
export async function recordCreditorResolutionAttempt(input: z.input<typeof resolutionInputSchema> & { organizationId: string; actorUserId: string }, client: Client = db) {
  const parsed = resolutionInputSchema.parse(input), capturedAt = new Date().toISOString();
  await initializeCreditorResolution(client);
  const existing = await client.execute({ sql: "SELECT * FROM creditor_resolution_attempts WHERE organization_id=? AND operation_id=? AND idempotency_key=?", args: [input.organizationId, parsed.operationId, parsed.idempotencyKey] });
  if (existing.rows[0]) return { duplicate: true as const, attempt: rowAttempt(existing.rows[0]) };
  const previousRows = await client.execute({ sql: "SELECT candidates_json FROM creditor_resolution_attempts WHERE organization_id=? AND operation_id=? AND query_state='RESULTS_FOUND' ORDER BY captured_at DESC LIMIT 100", args: [input.organizationId, parsed.operationId] });
  const previousCandidates = previousRows.rows.flatMap(row => JSON.parse(String(row.candidates_json)) as CreditorCandidateInput[]);
  const resolution = resolveCreditor({ queryState: parsed.queryState, resultCount: parsed.resultCount, candidates: parsed.candidates, previousCandidates, identifiers: parsed.identifiers, existingCreditorName: parsed.existingCreditorName });
  const id = crypto.randomUUID();
  await client.execute({ sql: "INSERT INTO creditor_resolution_attempts VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", args: [id, input.organizationId, parsed.operationId, parsed.source, parsed.sourceUrl, parsed.mode, parsed.queryKind, parsed.queryValue, parsed.queryState, parsed.resultCount, JSON.stringify(parsed.candidates), JSON.stringify(resolution), capturedAt, input.actorUserId, parsed.idempotencyKey] });
  return { duplicate: false as const, attempt: { id, organizationId: input.organizationId, operationId: parsed.operationId, source: parsed.source, sourceUrl: parsed.sourceUrl, mode: parsed.mode, queryKind: parsed.queryKind, queryValue: parsed.queryValue, queryState: parsed.queryState, resultCount: parsed.resultCount, candidates: parsed.candidates, ...resolution, capturedAt, actorUserId: input.actorUserId } };
}
function rowAttempt(row: Record<string, unknown>): CreditorResolutionAttempt { return { id: String(row.id), organizationId: String(row.organization_id), operationId: String(row.operation_id), source: String(row.source), sourceUrl: String(row.source_url), mode: String(row.mode) as CreditorResolutionAttempt["mode"], queryKind: String(row.query_kind), queryValue: String(row.query_value), queryState: String(row.query_state) as CreditorResolutionAttempt["queryState"], resultCount: Number(row.result_count), candidates: JSON.parse(String(row.candidates_json)) as CreditorCandidateInput[], ...JSON.parse(String(row.resolution_json)) as CreditorResolution, capturedAt: String(row.captured_at), actorUserId: String(row.actor_user_id) }; }
export async function listCreditorResolutionAttempts(organizationId: string, operationId?: string, client: Client = db) { await initializeCreditorResolution(client); const rows = await client.execute({ sql: operationId ? "SELECT * FROM creditor_resolution_attempts WHERE organization_id=? AND operation_id=? ORDER BY captured_at DESC LIMIT 100" : "SELECT * FROM creditor_resolution_attempts WHERE organization_id=? ORDER BY captured_at DESC LIMIT 1000", args: operationId ? [organizationId, operationId] : [organizationId] }); return rows.rows.map(rowAttempt); }
