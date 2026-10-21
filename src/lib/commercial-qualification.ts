import { isOfficialSourceUrl } from "./acquisition-sources";

export type CommercialMinimumState =
  | "QUALIFICACAO_MINIMA_APROVADA"
  | "PENDENTE_TITULAR"
  | "VALOR_AUSENTE_OU_ABAIXO"
  | "MUNICIPIO_FORA_ESCOPO"
  | "PENDENTE_DOCUMENTO"
  | "FONTE_BLOQUEADA"
  | "REVISAO_MANUAL";

export type CommercialMinimumDocument = {
  id: string;
  operationId: string;
  depre: string;
  creditorName: string;
  sourceUrl: string;
  title: string;
  documentIdentifier: string;
  status: "COLLECTED" | "VERIFIED" | "DIVERGENT" | "FAILED";
  evidenceStrength: "STRONG" | "MEDIUM" | "WEAK";
  /** Only true after an explicit link check; a URL string alone is insufficient. */
  linkAccessible: boolean;
  contentFingerprint?: string;
}

export type CommercialMinimumInput = {
  operationId: string;
  depre: string;
  creditorName: string;
  creditorVerified: boolean;
  identityConflict: boolean;
  amount: number | null;
  amountSource: string;
  amountIsEstimate?: boolean;
  debtor: string;
  sourceBlocked?: boolean;
  documents: readonly CommercialMinimumDocument[];
};

export type CommercialMinimumResult = {
  state: CommercialMinimumState;
  approved: boolean;
  reasons: string[];
  criteria: Array<{ key: string; ok: boolean; detail: string }>;
  qualifyingDocuments: CommercialMinimumDocument[];
  nextAction: string;
};

const MINIMUM_AMOUNT = 100_000;

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function acceptedDebtor(value: string) {
  const debtor = normalized(value);
  if (debtor.includes("fazenda") || debtor.includes("spprev") || debtor.includes("estado de sao paulo")) return false;
  return debtor.includes("campinas") || debtor.includes("guarulhos") || debtor.includes("municipio de sao paulo") || debtor.includes("municipalidade de sao paulo");
}

function documentIdentity(document: CommercialMinimumDocument) {
  return document.contentFingerprint?.trim().toLowerCase() ||
    document.documentIdentifier.trim().toLowerCase() ||
    `${document.sourceUrl.trim().toLowerCase()}|${document.title.trim().toLowerCase()}`;
}

export function evaluateCommercialMinimum(input: CommercialMinimumInput): CommercialMinimumResult {
  const criteria: CommercialMinimumResult["criteria"] = [];
  const reasons: string[] = [];
  const identityOk = Boolean(input.depre.trim()) && Boolean(input.creditorName.trim()) && input.creditorVerified && !input.identityConflict;
  criteria.push({ key: "creditor", ok: identityOk, detail: identityOk ? "Titular identificado em fonte verificável." : "Titular ausente, não comprovado ou em conflito." });
  if (!identityOk) reasons.push(input.identityConflict ? "IDENTITY_CONFLICT" : "CREDITOR_NOT_VERIFIED");

  const valueOk = Number.isFinite(input.amount) && input.amount !== null && input.amount >= MINIMUM_AMOUNT && !input.amountIsEstimate && Boolean(input.amountSource.trim());
  criteria.push({ key: "value", ok: valueOk, detail: valueOk ? "Valor publicado atende ao mínimo de R$ 100.000,00." : "Valor ausente, estimado, sem fonte ou abaixo do mínimo." });
  if (!valueOk) reasons.push("VALUE_NOT_ELIGIBLE");

  const debtorOk = acceptedDebtor(input.debtor);
  criteria.push({ key: "debtor", ok: debtorOk, detail: debtorOk ? "Entidade devedora dentro do escopo municipal." : "Município/entidade devedora fora do escopo ou não identificada." });
  if (!debtorOk) reasons.push("DEBTOR_OUTSIDE_SCOPE");

  const qualifying = input.documents.filter((document) =>
    document.operationId === input.operationId &&
    document.depre.trim() === input.depre.trim() &&
    document.creditorName.trim() === input.creditorName.trim() &&
    document.status === "VERIFIED" &&
    document.evidenceStrength === "STRONG" &&
    document.linkAccessible &&
    Boolean(document.documentIdentifier.trim()) &&
    isOfficialSourceUrl(document.sourceUrl),
  );
  const distinct = [...new Map(qualifying.map((document) => [documentIdentity(document), document])).values()];
  const documentsOk = distinct.length >= 2;
  criteria.push({ key: "officialDocuments", ok: documentsOk, detail: documentsOk ? "Dois documentos oficiais distintos, vinculados ao mesmo DEPRE/titular, com links acessíveis." : "São necessários dois documentos oficiais distintos, vinculados ao mesmo caso, com links acessíveis." });
  if (!documentsOk) reasons.push("OFFICIAL_DOCUMENTS_INSUFFICIENT");

  const approved = reasons.length === 0;
  const state: CommercialMinimumState = approved ? "QUALIFICACAO_MINIMA_APROVADA" :
    input.identityConflict ? "REVISAO_MANUAL" :
    !identityOk ? "PENDENTE_TITULAR" :
    !valueOk ? "VALOR_AUSENTE_OU_ABAIXO" :
    !debtorOk ? "MUNICIPIO_FORA_ESCOPO" :
    input.sourceBlocked ? "FONTE_BLOQUEADA" :
    "PENDENTE_DOCUMENTO";
  return { state, approved, reasons, criteria, qualifyingDocuments: distinct, nextAction: approved ? "Apresentar resumo comercial mínimo." : reasons[0] === "OFFICIAL_DOCUMENTS_INSUFFICIENT" ? "Localizar e validar o segundo ofício independente." : "Resolver o primeiro bloqueio indicado." };
}
