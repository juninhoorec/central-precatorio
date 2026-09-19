import { extractStructuralEvidence, type EvidenceItem } from "./document-evidence-engine";
import { type Operation } from "@/lib/operations";

export type RelationType = 
  | "SAME_PRECATORY"
  | "SAME_PROCESS"
  | "SAME_CREDITOR"
  | "SAME_DEBTOR"
  | "NEWER_VERSION"
  | "COMPLEMENTARY"
  | "CONFLICTING"
  | "RELATED"
  | "UNKNOWN";

export type PartyRole = 
  | "CREDOR"
  | "BENEFICIARIO"
  | "AUTOR"
  | "ADVOGADO"
  | "HERDEIRO"
  | "CESSIONARIO_CANDIDATE"
  | "SUCCESSOR_CANDIDATE"
  | "DEVEDOR"
  | "OUTRO"
  | "UNKNOWN";

export interface DocumentRelation {
  documentA: string;
  documentB: string;
  relationType: RelationType;
  confidence: number;
  reason: string;
  evidenceItems: EvidenceItem[];
}

export interface PartyEntry {
  name: string;
  documentId: string;
  role: PartyRole;
  confidence: number;
  evidence: EvidenceItem[];
}

export interface FieldConflict {
  field: string;
  values: { documentId: string; value: string; evidence: EvidenceItem[] }[];
  status: "CONFIRMED" | "AGREEMENT" | "CONFLICT" | "ONLY_SOURCE" | "UNKNOWN";
}

export interface CrossDocumentCoverage {
  documentsAnalyzed: number;
  pagesAnalyzed: number;
  documentsNotAnalyzed: string[];
  retrievalMethod: "DETERMINISTIC_PAGE_EXTRACTION";
  partial: boolean;
}

export interface CrossDocumentAnalysisResult {
  clusterId: string;
  documentsAnalyzed: number;
  coverage: CrossDocumentCoverage;
  relations: DocumentRelation[];
  partyMatrix: PartyEntry[];
  conflicts: FieldConflict[];
  sourceMatrix: FieldConflict[];
  cessionState: "NO_MENTION_FOUND_IN_ANALYZED_SCOPE" | "POSSIBLE_CESSION" | "CESSION_DOCUMENT_FOUND" | "CURRENT_EFFECT_NOT_CONFIRMED" | "HUMAN_REVIEW";
  successionState: "NO_MENTION_FOUND_IN_ANALYZED_SCOPE" | "POSSIBLE_SUCCESSION" | "SUCCESSION_EVIDENCE_FOUND" | "REVIEW_REQUIRED";
  currentHolderState: "CURRENT_HOLDER_CONFIRMED" | "CURRENT_HOLDER_CANDIDATE" | "POSSIBLE_TRANSFER" | "NOT_ESTABLISHED" | "CONFLICT";
  timeline: { date: string; event: string; sourceDocumentId?: string; evidence: EvidenceItem[] }[];
}

type AnalysisDocument = {
  id: string;
  name: string;
  createdAt: string;
  textPages: string[];
  organizationId?: string;
  evidence: EvidenceItem[];
};

type FieldObservation = { documentId: string; value: string; evidence: EvidenceItem[] };

const normalizeValue = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]/g, "");

function evidenceForLine(document: AnalysisDocument, pageIndex: number, text: string, keyword: string): EvidenceItem {
  const existing = document.evidence.find(item => item.page === pageIndex + 1 && item.textSpan === text);
  if (existing) return { ...existing, detectedKeywords: [keyword] };
  return {
    id: crypto.randomUUID(),
    documentId: document.id,
    organizationId: document.organizationId ?? "legacy-internal",
    page: pageIndex + 1,
    textSpan: text.slice(0, 300),
    normalizedText: normalizeValue(text),
    extractionMethod: "DETERMINISTIC",
    confidence: 90,
    strength: "STRONG_CONTEXT",
    detectedKeywords: [keyword]
  };
}

function observationsFor(document: AnalysisDocument, field: string, pattern: RegExp, keyword = field): FieldObservation[] {
  const observations: FieldObservation[] = [];
  document.textPages.forEach((page, pageIndex) => {
    for (const line of page.split("\n")) {
      const match = line.match(pattern);
      const value = match?.[1]?.trim();
      if (!value) continue;
      observations.push({ documentId: document.id, value, evidence: [evidenceForLine(document, pageIndex, line.trim(), keyword)] });
    }
  });
  return observations;
}

function matrixRow(field: string, values: FieldObservation[]): FieldConflict {
  const uniqueValues = new Set(values.map(item => normalizeValue(item.value)));
  const status: FieldConflict["status"] = values.length === 0
    ? "UNKNOWN"
    : uniqueValues.size > 1
      ? "CONFLICT"
      : values.length === 1
        ? "ONLY_SOURCE"
        : "AGREEMENT";
  return { field, values, status };
}

function documentFields(document: AnalysisDocument) {
  const allText = document.textPages.join("\n");
  const cnj = "(\\d{7}-\\d{2}\\.\\d{4}\\.\\d\\.\\d{2}\\.\\d{4})";
  const depreObservations = observationsFor(document, "Processo DEPRE", new RegExp(`(?:DEPRE[^\\n]*?|processo[^\\n]*?DEPRE[^\\n]*?)${cnj}`, "i"), "DEPRE");
  const originObservations = observationsFor(document, "Processo originário", new RegExp(`(?:origin[aá]rio|origem|autos de origem)[^\\n]*?${cnj}`, "i"), "PROCESSO_ORIGINARIO");
  const epesObservations = observationsFor(document, "EP/ES", /\b(EP|ES)\s*(?:n[ºo.]?\s*)?(\d[\d./-]*(?:\/\d{4})?)/i, "EP_ES").map(item => ({ ...item, value: `${item.value} ${item.evidence[0]?.textSpan.match(/\b\d[\d./-]*(?:\/\d{4})?/i)?.[0] ?? ""}`.trim() }));
  const precatoryObservations = observationsFor(document, "Precatório", /precat[oó]rio\s*(?:n[ºo.]?\s*)?([\w./-]+(?:\s*\/\s*\d{4})?)/i, "PRECATORIO");
  const debtorObservations = observationsFor(document, "Devedor", /(?:ente\s+devedor|devedor|executado)\s*[:\-]\s*([^.;\n]+)/i, "DEVEDOR");
  const valueObservations = observationsFor(document, "Valor", /(?:valor|montante|total atualizado)[^\n]{0,40}?(R\$\s*[\d.]+(?:,\d{2})?)/i, "VALOR");
  const statusObservations = observationsFor(document, "Status", /(?:situa[cç][aã]o|status)\s*[:\-]\s*([^.;\n]+)/i, "STATUS");
  const priorityObservations = observationsFor(document, "Prioridade", /prioridade\s*[:\-]\s*([^.;\n]+)/i, "PRIORIDADE");

  return {
    allText,
    fields: {
      "Credor/beneficiário": partyObservations(document, ["CREDOR", "BENEFICIARIO"]),
      "Processo DEPRE": depreObservations,
      "EP/ES": epesObservations,
      "Processo originário": originObservations,
      "Valor": valueObservations,
      "Devedor": debtorObservations,
      "Status": statusObservations,
      "Prioridade": priorityObservations,
      "Titular": partyObservations(document, ["CREDOR", "BENEFICIARIO", "CESSIONARIO_CANDIDATE", "SUCCESSOR_CANDIDATE"])
    },
    identifiers: [
      ...depreObservations.map(item => ({ key: "depre", type: "SAME_PRECATORY" as const, item })),
      ...epesObservations.map(item => ({ key: "epes", type: "SAME_PRECATORY" as const, item })),
      ...precatoryObservations.map(item => ({ key: "precatory", type: "SAME_PRECATORY" as const, item })),
      ...originObservations.map(item => ({ key: "origin", type: "SAME_PROCESS" as const, item })),
      ...debtorObservations.map(item => ({ key: "debtor", type: "SAME_DEBTOR" as const, item }))
    ]
  };
}

function partyObservations(document: AnalysisDocument, roles: PartyRole[]): FieldObservation[] {
  const labels: Array<{ pattern: RegExp; role: PartyRole }> = [
    { pattern: /(?:credor(?:a)?|credor(?:a)?\s+origin[aá]rio(?:a)?|titular(?:\s+do\s+cr[eé]dito)?)\s*[:\-]\s*([^.;\n]+)/i, role: "CREDOR" },
    { pattern: /benefici[aá]rio(?:\s+titular)?\s*[:\-]\s*([^.;\n]+)/i, role: "BENEFICIARIO" },
    { pattern: /autor(?:a)?\s*[:\-]\s*([^.;\n]+)/i, role: "AUTOR" },
    { pattern: /(?:advogado(?:a)?|procurador(?:a)?)\s*[:\-]\s*([^.;\n]+)/i, role: "ADVOGADO" },
    { pattern: /devedor\s*[:\-]\s*([^.;\n]+)/i, role: "DEVEDOR" },
    { pattern: /(?:herdeiro(?:a)?|sucessor(?:a)?)\s*[:\-]\s*([^.;\n]+)/i, role: "HERDEIRO" },
    { pattern: /cession[aá]rio(?:a)?\s*[:\-]\s*([^.;\n]+)/i, role: "CESSIONARIO_CANDIDATE" }
  ];
  const result: FieldObservation[] = [];
  document.textPages.forEach((page, pageIndex) => {
    for (const line of page.split("\n")) {
      for (const { pattern, role } of labels) {
        const value = line.match(pattern)?.[1]?.trim();
        if (!value || (roles.length > 0 && !roles.includes(role))) continue;
        result.push({ documentId: document.id, value, evidence: [evidenceForLine(document, pageIndex, line.trim(), role)] });
      }
    }
  });
  return result;
}

export function buildCrossDocumentContext(
  operation: Operation,
  documents: { id: string; name: string; createdAt: string; textPages: string[]; organizationId?: string }[],
  documentsNotAnalyzed: string[] = []
): CrossDocumentAnalysisResult {
  const relations: DocumentRelation[] = [];
  const partyMatrix: PartyEntry[] = [];
  const docExtracts: AnalysisDocument[] = documents.map(doc => ({
    ...doc,
    evidence: extractStructuralEvidence(doc.id, doc.organizationId ?? "legacy-internal", doc.textPages)
  }));
  const extracted = docExtracts.map(document => ({ document, data: documentFields(document) }));

  for (const { document } of extracted) {
    for (const person of partyObservations(document, [])) {
      const role = person.evidence[0]?.detectedKeywords[0] as PartyRole | undefined;
      if (!role) continue;
      partyMatrix.push({ name: person.value, documentId: document.id, role, confidence: 90, evidence: person.evidence });
    }
  }

  // A relation is emitted only when a canonical identifier is present in both documents.
  for (let i = 0; i < docExtracts.length; i++) {
    for (let j = i + 1; j < docExtracts.length; j++) {
      const fieldsA = extracted[i].data;
      const fieldsB = extracted[j].data;
      const matches = fieldsA.identifiers.flatMap(identifierA => fieldsB.identifiers
        .filter(identifierB => identifierA.key === identifierB.key && normalizeValue(identifierA.item.value) === normalizeValue(identifierB.item.value))
        .map(identifierB => ({ identifierA, identifierB })));
      if (matches.length > 0) {
        const { identifierA, identifierB } = matches[0];
        relations.push({
          documentA: docExtracts[i].id,
          documentB: docExtracts[j].id,
          relationType: identifierA.type,
          confidence: 100,
          reason: `Identificador canônico coincidente: ${identifierA.item.value}`,
          evidenceItems: [...identifierA.item.evidence, ...identifierB.item.evidence]
        });
      }
    }
  }

  const sourceMatrix = ["Credor/beneficiário", "Processo DEPRE", "EP/ES", "Processo originário", "Valor", "Devedor", "Status", "Prioridade", "Titular"].map(field =>
    matrixRow(field, extracted.flatMap(({ data }) => data.fields[field as keyof typeof data.fields]))
  );
  const conflicts = sourceMatrix.filter(field => field.status === "CONFLICT");
  const partyConflict = sourceMatrix.find(field => field.field === "Credor/beneficiário")?.status === "CONFLICT";
  const cessionEvidence = docExtracts.flatMap(doc => doc.evidence.filter(item => item.detectedKeywords.includes("CESSAO")));
  const successionEvidence = docExtracts.flatMap(doc => doc.evidence.filter(item => item.detectedKeywords.includes("SUCESSAO")));
  const cessionDocumentEvidence = cessionEvidence.filter(item => /^(?:termo|instrumento|contrato)\s+de\s+cess[aã]o\b/i.test(item.textSpan) && !/mencionad[oa]|referid[oa]|poss[ií]vel/i.test(item.textSpan));
  const successionDocumentEvidenceFound = docExtracts.some(doc => doc.textPages.some(page => /certid[aã]o de [oó]bito|formal de partilha|termo de invent[aá]rio/i.test(page)));

  const timeline = documents.map(d => ({
    date: d.createdAt,
    event: `Documento ${d.name} recebido`,
    sourceDocumentId: d.id,
    evidence: docExtracts.find(item => item.id === d.id)?.evidence.slice(0, 1) ?? []
  })).sort((a, b) => a.date.localeCompare(b.date));

  const pagesAnalyzed = docExtracts.reduce((total, document) => total + document.textPages.length, 0);
  const currentHolderState: CrossDocumentAnalysisResult["currentHolderState"] = partyConflict
    ? "CONFLICT"
    : cessionEvidence.length > 0 || successionEvidence.length > 0
      ? "POSSIBLE_TRANSFER"
      : partyMatrix.some(person => person.role === "CREDOR" || person.role === "BENEFICIARIO")
        ? "CURRENT_HOLDER_CANDIDATE"
        : "NOT_ESTABLISHED";

  return {
    clusterId: operation.id,
    documentsAnalyzed: documents.length,
    coverage: {
      documentsAnalyzed: documents.length,
      pagesAnalyzed,
      documentsNotAnalyzed,
      retrievalMethod: "DETERMINISTIC_PAGE_EXTRACTION",
      partial: documentsNotAnalyzed.length > 0
    },
    relations,
    partyMatrix,
    conflicts,
    sourceMatrix,
    cessionState: cessionDocumentEvidence.length > 0 ? "CESSION_DOCUMENT_FOUND" : cessionEvidence.length > 0 ? "POSSIBLE_CESSION" : "NO_MENTION_FOUND_IN_ANALYZED_SCOPE",
    successionState: successionDocumentEvidenceFound ? "SUCCESSION_EVIDENCE_FOUND" : successionEvidence.length > 0 ? "POSSIBLE_SUCCESSION" : "NO_MENTION_FOUND_IN_ANALYZED_SCOPE",
    currentHolderState,
    timeline
  };
}
