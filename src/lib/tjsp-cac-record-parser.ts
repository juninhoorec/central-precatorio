import { parseAmount } from "./tjsp-import";

export type CacTextItem = { text: string; x: number; y: number };

export type CacRejectionReason =
  | "INVALID_START"
  | "MISSING_CAC_BLOCK"
  | "MISSING_DEPRE"
  | "INVALID_DEPRE_FORMAT"
  | "MISSING_DEBTOR"
  | "NESTED_RECORD"
  | "TRUNCATED_RECORD"
  | "UNEXPECTED_LAYOUT"
  | "OTHER";

export type CacFieldEvidence = {
  documentId?: string;
  field: string;
  page: number;
  textSpan: string;
  source: "DOCUMENT" | "REPORT_HEADER";
  method: "PDF_POSITIONAL_TEXT";
};

export type CacHeaderEvidence = { value: string; page: number; textSpan: string };

export type TjspCacRecord = {
  documentId?: string;
  paymentOrder: string;
  creditNumber: string;
  numeroProcessoDEPRE: string;
  numeroAutos: string;
  numeroProcessoOriginario: string;
  epesNumber: string;
  epesYear: string;
  numeroEPES: string;
  creditor: string;
  debtor: string;
  debtorSource: "RECORD" | "REPORT_HEADER";
  municipality: string;
  amount: number | null;
  valueDate: string;
  protocolDate: string;
  type: "PRECATORY" | "RPV";
  court: "TJSP";
  nature: string;
  protocol: string;
  generalProtocol: string;
  budgetOrder: string;
  suspended: string;
  superPriority: string;
  originProcessNumber: string;
  legacyProcess: string;
  attorneys: string[];
  startPage: number;
  endPage: number;
  page: number;
  record: number;
  archiveEntry: string;
  rawText: string;
  fieldEvidence: CacFieldEvidence[];
  missingOptionalFields: string[];
};

export type CacRejectedCandidate = {
  documentId?: string;
  record: number;
  startPage: number;
  endPage: number;
  reason: CacRejectionReason;
};

export type CacParserStats = {
  candidateStarts: number;
  acceptedRecords: number;
  rejectedCandidates: number;
  spanningRecords: number;
  rejectionReasons: Record<CacRejectionReason, number>;
};

export type CacParserOptions = {
  documentId?: string;
  archiveEntry?: string;
  reportHeaderDebtor?: CacHeaderEvidence | null;
  collectRecords?: boolean;
  onRecord?: (record: TjspCacRecord) => void;
  onRejected?: (candidate: CacRejectedCandidate) => void;
};

export type CacPageResult = { records: TjspCacRecord[]; rejected: CacRejectedCandidate[] };

export type CacParserSummary = {
  stats: CacParserStats;
  records: TjspCacRecord[];
  rejected: CacRejectedCandidate[];
};

type LayoutLine = { page: number; y: number; text: string };
type FieldKey =
  | "paymentOrder"
  | "nature"
  | "numeroProcessoDEPRE"
  | "numeroAutos"
  | "epes"
  | "budgetOrder"
  | "suspended"
  | "superPriority"
  | "amount"
  | "protocolDate"
  | "generalProtocol"
  | "protocol"
  | "legacyProcess"
  | "attorneys"
  | "debtor";
type FieldDefinition = { key: FieldKey; pattern: RegExp };
type FieldValue = { value: string; evidence: CacFieldEvidence[] };
type ActiveCandidate = { record: number; startPage: number; lines: LayoutLine[]; waitingForDebtorValue: boolean };

const processPattern = /[0-9]{7}-[0-9]{2}\.[0-9]{4}\.[0-9]\.[0-9]{2}\.[0-9]{4}/;
const fieldDefinitions: FieldDefinition[] = [
  { key: "numeroProcessoDEPRE", pattern: /N[º°.]?\s*Processo\s+DEPRE\s*:/i },
  { key: "numeroAutos", pattern: /(?:N[º°.]?\s*(?:de\s+)?)?autos\s*:/i },
  { key: "legacyProcess", pattern: /(?:N[º°.]?\s*(?:de\s+)?)?autos\s+antigos\s*:/i },
  { key: "epes", pattern: /(?:ES\s*[/\\]\s*EP|EP\s*[/\\]\s*ES)\s*:/i },
  { key: "budgetOrder", pattern: /Ordem\s+Orçamentária\s*:/i },
  { key: "generalProtocol", pattern: /N[º°.]?\s*(?:do\s+)?Protocolo\s+Geral\s*:/i },
  { key: "protocolDate", pattern: /Data(?:\s+(?:do\s+)?Protocolo)?\s*:/i },
  { key: "paymentOrder", pattern: /Ordem\s+de\s+Pagamento\s*:/i },
  { key: "paymentOrder", pattern: /^\s*Ordem\s*:/i },
  { key: "paymentOrder", pattern: /^\s*Ordem\s+([0-9]{1,12})\b/i },
  { key: "nature", pattern: /Natureza\s*:/i },
  { key: "suspended", pattern: /Suspenso\s*\?\s*:?/i },
  { key: "superPriority", pattern: /Superpreferência\s*:/i },
  { key: "amount", pattern: /Valor\s+atualizado\s*:/i },
  { key: "protocol", pattern: /Protocolo\s*:/i },
  { key: "attorneys", pattern: /Advogado\s*\(\s*s\s*\)\s*:/i },
  { key: "debtor", pattern: /Devedora\s*:/i },
];

function pageLines(items: readonly CacTextItem[], page: number): LayoutLine[] {
  const grouped = new Map<number, CacTextItem[]>();
  for (const item of items) {
    const y = Math.round(item.y);
    const group = grouped.get(y) ?? [];
    group.push(item);
    grouped.set(y, group);
  }
  return [...grouped.entries()]
    .sort(([yA], [yB]) => yB - yA)
    .map(([y, parts]) => ({
      page,
      y,
      text: parts.sort((a, b) => a.x - b.x).map(part => part.text.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim(),
    }))
    .filter(line => line.text.length > 0);
}

function findFieldDefinition(text: string, key: FieldKey): { definition: FieldDefinition; match: RegExpExecArray } | null {
  for (const definition of fieldDefinitions) {
    if (definition.key !== key) continue;
    const match = new RegExp(definition.pattern.source, definition.pattern.flags).exec(text);
    if (match) return { definition, match };
  }
  return null;
}

function findNextFieldLabel(text: string, from: number, exclude?: FieldKey): number {
  let next = text.length;
  for (const definition of fieldDefinitions) {
    if (definition.key === exclude) continue;
    const match = new RegExp(definition.pattern.source, definition.pattern.flags).exec(text);
    if (match && match.index >= from && match.index < next) next = match.index;
  }
  return next;
}

function valueOnLine(line: LayoutLine, key: FieldKey): string | null {
  const found = findFieldDefinition(line.text, key);
  if (!found) return null;
  if (found.match[1]) return found.match[1].trim();
  const valueStart = found.match.index + found.match[0].length;
  const valueEnd = findNextFieldLabel(line.text, valueStart, key);
  const rawValue = line.text.slice(valueStart, valueEnd).replace(/^[\s:：]+/, "").trim();
  if (key === "protocolDate") return rawValue.match(/[0-9]{2}[/-][0-9]{2}[/-][0-9]{4}/)?.[0] ?? null;
  if (key === "protocol") {
    const prefix = line.text.slice(0, found.match.index);
    if (/Data(?:\s+do)?\s*$/i.test(prefix)) return null;
  }
  if (key !== "amount") return rawValue.replace(/^-+/, "").trim() || null;
  return rawValue || null;
}

function fieldEvidence(documentId: string | undefined, field: string, line: LayoutLine, textSpan = line.text): CacFieldEvidence {
  return {
    ...(documentId ? { documentId } : {}),
    field,
    page: line.page,
    textSpan,
    source: "DOCUMENT",
    method: "PDF_POSITIONAL_TEXT",
  };
}

function extractField(lines: readonly LayoutLine[], key: FieldKey, documentId?: string): FieldValue | null {
  for (let index = 0; index < lines.length; index++) {
    const found = findFieldDefinition(lines[index].text, key);
    if (!found) continue;
    const firstValue = valueOnLine(lines[index], key);
    const values: string[] = firstValue ? [firstValue] : [];
    const evidenceText = found.match[1]
      ? found.match[0].trim()
      : [found.match[0].trim(), firstValue].filter(Boolean).join(" ");
    const evidence = [fieldEvidence(documentId, key, lines[index], evidenceText || lines[index].text)];
    const collectFollowing = key === "attorneys" || !firstValue;
    if (collectFollowing) {
      for (let next = index + 1; next < lines.length; next++) {
        if (findFieldDefinition(lines[next].text, key)) continue;
        if (fieldDefinitions.some(definition => new RegExp(definition.pattern.source, definition.pattern.flags).test(lines[next].text))) break;
        values.push(lines[next].text.trim());
        evidence.push(fieldEvidence(documentId, key, lines[next]));
        if (key !== "attorneys") break;
      }
    }
    const value = values.join(key === "attorneys" ? "\n" : " ").trim();
    return value ? { value, evidence } : null;
  }
  return null;
}

function extractOriginProcess(lines: readonly LayoutLine[], documentId?: string): FieldValue | null {
  const paymentIndex = lines.findIndex(line => isPaymentCandidate(line));
  const prelude = paymentIndex < 0 ? lines : lines.slice(0, paymentIndex);
  const line = prelude.find(item => processPattern.test(item.text) && !findFieldDefinition(item.text, "numeroProcessoDEPRE"));
  const value = line?.text.match(processPattern)?.[0];
  return line && value
    ? { value, evidence: [fieldEvidence(documentId, "numeroProcessoOriginario", line)] }
    : null;
}

function isPaymentCandidate(line: LayoutLine): boolean {
  return Boolean(findFieldDefinition(line.text, "paymentOrder"));
}

function hasValidCnj(value: string | null): boolean {
  return value !== null && processPattern.test(value);
}

function parseEpes(value: string | null): { number: string; year: string } {
  const match = value?.match(/([0-9]{1,8})\s*[/.-]\s*([0-9]{4})/);
  return match ? { number: match[1], year: match[2] } : { number: "", year: "" };
}

function splitAttorneys(value: string | null): string[] {
  return value?.split(/\n+/).map(item => item.trim()).filter(Boolean) ?? [];
}

function readHeaderDebtorFromText(text: string): CacHeaderEvidence | null {
  const folded = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim();
  const match = folded.match(/lista de precatorios pendentes de pagamento em [0-9]{2}\/[0-9]{2}\/[0-9]{4} da (.+?), protocolados/i);
  if (!match?.[1]) return null;
  return { value: match[1].trim(), page: 1, textSpan: match[0] };
}

export function extractCacReportHeader(items: readonly CacTextItem[]): CacHeaderEvidence | null {
  const lines = pageLines(items, 1);
  return readHeaderDebtorFromText(lines.map(line => line.text).join(" "));
}

export class TjspCacRecordParser {
  private active: ActiveCandidate | null = null;
  private pendingOrigin: LayoutLine[] = [];
  private candidateNumber = 0;
  private finished = false;
  private records: TjspCacRecord[] = [];
  private rejected: CacRejectedCandidate[] = [];
  readonly stats: CacParserStats = {
    candidateStarts: 0,
    acceptedRecords: 0,
    rejectedCandidates: 0,
    spanningRecords: 0,
    rejectionReasons: { INVALID_START: 0, MISSING_CAC_BLOCK: 0, MISSING_DEPRE: 0, INVALID_DEPRE_FORMAT: 0, MISSING_DEBTOR: 0, NESTED_RECORD: 0, TRUNCATED_RECORD: 0, UNEXPECTED_LAYOUT: 0, OTHER: 0 },
  };

  constructor(private readonly options: CacParserOptions = {}) {}

  pushPage(page: number, items: readonly CacTextItem[]): CacPageResult {
    if (this.finished) throw new Error("CAC parser already finished");
    const emitted: CacPageResult = { records: [], rejected: [] };
    for (const line of pageLines(items, page)) {
      const isStart = isPaymentCandidate(line);
      if (!this.active) {
        if (isStart) {
          this.stats.candidateStarts++;
          this.candidateNumber++;
          const prefixIsOrigin = this.pendingOrigin.some(item => processPattern.test(item.text)) && this.pendingOrigin.some(item => /Natureza\s*:|ALIMENTARES|OUTRAS\s+ESP[ÉE]CIES/i.test(item.text));
          const prefix = prefixIsOrigin ? this.pendingOrigin : [];
          this.active = { record: this.candidateNumber, startPage: prefix[0]?.page ?? page, lines: [...prefix, line], waitingForDebtorValue: false };
          this.pendingOrigin = [];
          continue;
        }
        if (processPattern.test(line.text) && !findFieldDefinition(line.text, "numeroProcessoDEPRE")) {
          this.pendingOrigin.push(line);
          if (this.pendingOrigin.length > 4) this.pendingOrigin.shift();
        } else if (this.pendingOrigin.length && /Natureza\s*:|ALIMENTARES|OUTRAS\s+ESP[ÉE]CIES/i.test(line.text)) {
          this.pendingOrigin.push(line);
        } else if (this.pendingOrigin.length > 2) {
          this.pendingOrigin = [];
        }
        continue;
      }

      if (isStart) {
        const reason = this.hasStructuralCore(this.active.lines) && !this.getDebtor(this.active.lines) && !this.options.reportHeaderDebtor ? "NESTED_RECORD" : undefined;
        const previous = this.finishActive(reason);
        this.addBatch(emitted, previous);
        this.stats.candidateStarts++;
        this.candidateNumber++;
        this.active = { record: this.candidateNumber, startPage: page, lines: [line], waitingForDebtorValue: false };
        continue;
      }

      this.active.lines.push(line);
      const debtor = extractField(this.active.lines, "debtor", this.options.documentId);
      if (debtor?.value) {
        const recordBatch = this.finishActive();
        this.addBatch(emitted, recordBatch);
      } else if (findFieldDefinition(line.text, "debtor")) {
        this.active.waitingForDebtorValue = true;
      } else if (this.active.waitingForDebtorValue && line.text.trim()) {
        const recordBatch = this.finishActive();
        this.addBatch(emitted, recordBatch);
      }
    }
    return emitted;
  }

  finish(): CacParserSummary {
    if (!this.finished) {
      this.finished = true;
      if (this.active) this.finishActive(undefined, true);
    }
    return { stats: structuredClone(this.stats), records: this.records, rejected: this.rejected };
  }

  private addBatch(target: CacPageResult, batch: CacPageResult): void {
    target.records.push(...batch.records);
    target.rejected.push(...batch.rejected);
  }

  private hasStructuralCore(lines: readonly LayoutLine[]): boolean {
    return Boolean(extractField(lines, "paymentOrder", this.options.documentId) && extractField(lines, "numeroProcessoDEPRE", this.options.documentId) && extractField(lines, "nature", this.options.documentId));
  }

  private getDebtor(lines: readonly LayoutLine[]): FieldValue | null {
    return extractField(lines, "debtor", this.options.documentId);
  }

  private finishActive(overrideReason?: CacRejectionReason, endOfDocument = false): CacPageResult {
    const result: CacPageResult = { records: [], rejected: [] };
    const active = this.active;
    this.active = null;
    if (!active) return result;

    const paymentOrder = extractField(active.lines, "paymentOrder", this.options.documentId);
    const originProcess = extractOriginProcess(active.lines, this.options.documentId);
    const nature = extractField(active.lines, "nature", this.options.documentId);
    const depre = extractField(active.lines, "numeroProcessoDEPRE", this.options.documentId);
    const autos = extractField(active.lines, "numeroAutos", this.options.documentId);
    const epes = extractField(active.lines, "epes", this.options.documentId);
    const budgetOrder = extractField(active.lines, "budgetOrder", this.options.documentId);
    const suspended = extractField(active.lines, "suspended", this.options.documentId);
    const superPriority = extractField(active.lines, "superPriority", this.options.documentId);
    const amount = extractField(active.lines, "amount", this.options.documentId);
    const protocolDate = extractField(active.lines, "protocolDate", this.options.documentId);
    const generalProtocol = extractField(active.lines, "generalProtocol", this.options.documentId);
    const protocol = extractField(active.lines, "protocol", this.options.documentId);
    const legacyProcess = extractField(active.lines, "legacyProcess", this.options.documentId);
    const attorneys = extractField(active.lines, "attorneys", this.options.documentId);
    const explicitDebtor = this.getDebtor(active.lines);
    const headerDebtor = this.options.reportHeaderDebtor;
    const debtor = explicitDebtor?.value ?? headerDebtor?.value ?? null;
    const allEvidence = [paymentOrder, originProcess, nature, depre, autos, epes, budgetOrder, suspended, superPriority, amount, protocolDate, generalProtocol, protocol, legacyProcess, attorneys, explicitDebtor].flatMap(field => field?.evidence ?? []);
    if (!explicitDebtor && headerDebtor) allEvidence.push({ ...(this.options.documentId ? { documentId: this.options.documentId } : {}), field: "devedora", page: headerDebtor.page, textSpan: headerDebtor.textSpan, source: "REPORT_HEADER", method: "PDF_POSITIONAL_TEXT" });

    let reason = overrideReason ?? this.validate({ paymentOrder, nature, depre, debtor, rawText: active.lines.map(line => line.text).join("\n") });
    if (endOfDocument && reason === "MISSING_DEBTOR") reason = "TRUNCATED_RECORD";
    if (reason) {
      const rejected: CacRejectedCandidate = { ...(this.options.documentId ? { documentId: this.options.documentId } : {}), record: active.record, startPage: active.startPage, endPage: active.lines.at(-1)?.page ?? active.startPage, reason };
      this.stats.rejectedCandidates++;
      this.stats.rejectionReasons[reason]++;
      result.rejected.push(rejected);
      this.options.onRejected?.(rejected);
      if (this.options.collectRecords !== false) this.rejected.push(rejected);
      return result;
    }

    const startPage = active.startPage;
    const endPage = active.lines.at(-1)?.page ?? startPage;
    const epesParts = parseEpes(epes?.value ?? null);
    const amountNumber = amount?.value ? parseAmount(amount.value) : null;
    const record: TjspCacRecord = {
      ...(this.options.documentId ? { documentId: this.options.documentId } : {}),
      paymentOrder: paymentOrder?.value ?? "",
      creditNumber: "",
      numeroProcessoDEPRE: depre?.value.match(processPattern)?.[0] ?? "",
      numeroAutos: autos?.value.match(processPattern)?.[0] ?? autos?.value ?? "",
      numeroProcessoOriginario: originProcess?.value ?? "",
      epesNumber: epesParts.number,
      epesYear: epesParts.year,
      numeroEPES: epes?.value ?? "",
      creditor: "",
      debtor: debtor ?? "",
      debtorSource: explicitDebtor ? "RECORD" : "REPORT_HEADER",
      municipality: "",
      amount: amountNumber,
      valueDate: "",
      protocolDate: protocolDate?.value ?? "",
      type: /RPV|OPV|pequeno valor/i.test(nature?.value ?? "") ? "RPV" : "PRECATORY",
      court: "TJSP",
      nature: nature?.value ?? "",
      protocol: protocol?.value ?? "",
      generalProtocol: generalProtocol?.value ?? "",
      budgetOrder: budgetOrder?.value ?? "",
      suspended: suspended?.value ?? "",
      superPriority: superPriority?.value ?? "",
      originProcessNumber: originProcess?.value ?? "",
      legacyProcess: legacyProcess?.value ?? "",
      attorneys: splitAttorneys(attorneys?.value ?? null),
      startPage,
      endPage,
      page: startPage,
      record: active.record,
      archiveEntry: this.options.archiveEntry ?? "",
      rawText: active.lines.map(line => line.text).join("\n"),
      fieldEvidence: allEvidence,
      missingOptionalFields: ["numeroAutos", "epes", "budgetOrder", "suspended", "superPriority", "protocolDate", "generalProtocol", "legacyProcess", "attorneys"].filter(key => {
        const fields: Record<string, FieldValue | null> = { numeroAutos: autos, epes, budgetOrder, suspended, superPriority, protocolDate, generalProtocol, legacyProcess, attorneys };
        return !fields[key]?.value;
      }),
    };
    this.stats.acceptedRecords++;
    if (endPage > startPage) this.stats.spanningRecords++;
    result.records.push(record);
    this.options.onRecord?.(record);
    if (this.options.collectRecords !== false) this.records.push(record);
    return result;
  }

  private validate(input: { paymentOrder: FieldValue | null; nature: FieldValue | null; depre: FieldValue | null; debtor: string | null; rawText: string }): CacRejectionReason | undefined {
    if (!input.rawText.trim()) return "OTHER";
    if (!input.paymentOrder?.value) return "MISSING_CAC_BLOCK";
    if (!/^\d{1,12}(?:[./-]\d{2,4})?$/.test(input.paymentOrder.value.trim())) return "INVALID_START";
    if (!input.depre?.value) return "MISSING_DEPRE";
    if (!hasValidCnj(input.depre.value)) return "INVALID_DEPRE_FORMAT";
    if (!input.nature?.value) return "UNEXPECTED_LAYOUT";
    if (!input.debtor?.trim()) return "MISSING_DEBTOR";
    return undefined;
  }
}
