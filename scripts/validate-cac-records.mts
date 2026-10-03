import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractCacReportHeader, TjspCacRecordParser, type TjspCacRecord } from "@/lib/tjsp-cac-record-parser";
import { parseAmount } from "@/lib/tjsp-import";
import { normalizeDepreIdentifier } from "@/lib/identifier-normalizer";

const root = resolve(".local-data/real-cac");
const manifest = JSON.parse(await readFile(resolve(root, "INGESTION_SUMMARY.json"), "utf8")) as {
  documents: Array<{ documentId: string; filename: string; sha256: string; pages: number; recordsUnvalidated: number; sourceReferenceDate: string; collectedAt: string }>;
};
const summaryOnly = process.argv.includes("--summary");
const requestedNames = new Set(process.argv.slice(2).filter(argument => argument !== "--summary"));
const selected = manifest.documents.filter(document => requestedNames.size === 0 || requestedNames.has(document.filename));
if (selected.length === 0) throw new Error("No requested CAC documents found in the local ingestion manifest.");

const output = [];
const crossDocumentDepre = new Map<string, Map<string, Set<number>>>();
const depreOccurrencesByDocument = new Map<string, Map<string, number>>();
const evidenceFieldNames = ["paymentOrder", "numeroProcessoDEPRE", "numeroAutos", "numeroProcessoOriginario", "nature", "numeroEPES", "budgetOrder", "suspended", "superPriority", "amount", "protocolDate", "generalProtocol", "legacyProcess", "attorneys", "debtor"] as const;
const evidenceChecks: Record<string, { checked: number; supported: number; unsupported: number }> = Object.fromEntries(evidenceFieldNames.map(name => [name, { checked: 0, supported: 0, unsupported: 0 }]));
const normalizeEvidence = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const moneyEvidenceMatches = (span: string, value: number) => {
  const parsed = parseAmount(span);
  return parsed !== null && Math.round(parsed * 100) === Math.round(value * 100);
};
const moneyTextStyle = (span: string) => {
  if (/R\$/i.test(span)) return "CURRENCY_SYMBOL";
  const numericTokens = span.match(/[0-9][0-9.,]*/g) ?? [];
  if (numericTokens.length !== 1) return numericTokens.length > 1 ? "MULTIPLE_NUMERIC_TOKENS" : "NO_NUMERIC_TOKEN";
  if (/^[0-9]{1,3}(?:\.[0-9]{3})+,\d{2}$/.test(numericTokens[0])) return "GROUPED_DECIMAL_COMMA";
  if (/^\d+,\d{2}$/.test(numericTokens[0])) return "DECIMAL_COMMA";
  if (/^\d+(?:\.\d{2})$/.test(numericTokens[0])) return "DECIMAL_DOT";
  if (/^\d+$/.test(numericTokens[0])) return "INTEGER";
  return "OTHER_NUMERIC_FORMAT";
};
for (const document of selected) {
  const bytes = new Uint8Array(await readFile(resolve(root, document.filename)));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256.toLowerCase() !== document.sha256.toLowerCase()) throw new Error(`SHA-256 mismatch for ${document.filename}`);

  const loadingTask = pdfjs.getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true });
  const pdf = await loadingTask.promise;
  const fieldNames = [
    "paymentOrder", "numeroProcessoDEPRE", "numeroAutos", "numeroProcessoOriginario", "nature", "numeroEPES",
    "budgetOrder", "suspended", "superPriority", "amount", "protocolDate", "generalProtocol", "legacyProcess", "attorneys", "debtor"
  ] as const;
  const fieldCounts: Record<string, number> = Object.fromEntries(fieldNames.map(name => [name, 0]));
  const fieldEvidenceFailureSamples: Array<Record<string, unknown>> = [];
  const invalidEvidenceReasonCounts: Record<string, number> = {};
  const invalidEvidenceSamples: Array<Record<string, unknown>> = [];
  const rejectionSamples: Record<string, number> = {};
  const samples: Array<Record<string, unknown>> = [];
  const sampleInterval = Math.max(1, Math.floor(document.recordsUnvalidated / 10));
  const depreCounts = new Map<string, number>();
  let depreOccurrences = 0;
  let depreNormalizationFailures = 0;
  const sampledNature = new Set<string>();
  let sampledEpesPresent = false;
  let sampledEpesAbsent = false;
  let sampledMultipleAttorneys = false;
  let sampledBoundary = false;
  let sampledOptionalMissing = false;
  let sampledLaterPage = false;
  let invalidEvidenceSpans = 0;
  const firstPage = await pdf.getPage(1);
  const firstContent = await firstPage.getTextContent();
  const firstItems = firstContent.items
    .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item)
    .map(item => ({ text: item.str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) }));
  const headerDebtor = extractCacReportHeader(firstItems);

  const parser = new TjspCacRecordParser({
    documentId: document.documentId,
    archiveEntry: document.filename,
    reportHeaderDebtor: headerDebtor,
    collectRecords: false,
    onRecord(record: TjspCacRecord) {
      const values: Record<(typeof fieldNames)[number], unknown> = {
        paymentOrder: record.paymentOrder,
        numeroProcessoDEPRE: record.numeroProcessoDEPRE,
        numeroAutos: record.numeroAutos,
        numeroProcessoOriginario: record.numeroProcessoOriginario,
        nature: record.nature,
        numeroEPES: record.numeroEPES,
        budgetOrder: record.budgetOrder,
        suspended: record.suspended,
        superPriority: record.superPriority,
        amount: record.amount,
        protocolDate: record.protocolDate,
        generalProtocol: record.generalProtocol,
        legacyProcess: record.legacyProcess,
        attorneys: record.attorneys,
        debtor: record.debtor,
      };
      const fieldEvidenceKey: Record<(typeof fieldNames)[number], string> = {
        paymentOrder: "paymentOrder",
        numeroProcessoDEPRE: "numeroProcessoDEPRE",
        numeroAutos: "numeroAutos",
        numeroProcessoOriginario: "numeroProcessoOriginario",
        nature: "nature",
        numeroEPES: "epes",
        budgetOrder: "budgetOrder",
        suspended: "suspended",
        superPriority: "superPriority",
        amount: "amount",
        protocolDate: "protocolDate",
        generalProtocol: "generalProtocol",
        legacyProcess: "legacyProcess",
        attorneys: "attorneys",
        debtor: record.debtorSource === "REPORT_HEADER" ? "devedora" : "debtor",
      };
      for (const field of fieldNames) {
        const value = values[field];
        if (value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)) fieldCounts[field]++;
        if (value === null || value === "" || (Array.isArray(value) && value.length === 0)) continue;
        const matchingEvidence = record.fieldEvidence.filter(evidence => evidence.field === fieldEvidenceKey[field]);
        const spans = matchingEvidence.map(evidence => evidence.textSpan);
        const supported = field === "amount"
          ? typeof value === "number" && spans.some(span => moneyEvidenceMatches(span, value))
          : field === "attorneys"
            ? (value as string[]).every(attorney => spans.some(span => normalizeEvidence(span).includes(normalizeEvidence(attorney))))
            : spans.some(span => normalizeEvidence(span).includes(normalizeEvidence(String(value))));
        evidenceChecks[field].checked++;
        if (supported) evidenceChecks[field].supported++;
        else {
          evidenceChecks[field].unsupported++;
          if (fieldEvidenceFailureSamples.length < 25) {
            const parsedEvidenceAmounts = matchingEvidence.map(evidence => parseAmount(evidence.textSpan)).filter((amount): amount is number => amount !== null);
            const amountDifferenceBuckets = typeof value === "number" ? parsedEvidenceAmounts.map(amount => {
              const ratio = value === 0 ? Number.POSITIVE_INFINITY : amount / value;
              const centsDifference = Math.abs(Math.round(amount * 100) - Math.round(value * 100));
              if (centsDifference === 0) return "EXACT_CENTS";
              if (centsDifference === 1) return "ONE_CENT";
              if (centsDifference <= 100) return "UP_TO_ONE_REAL";
              if (Math.abs(amount - value) < 0.005) return "SAME_VALUE";
              if (Math.abs(ratio - 100) < 0.000001) return "EVIDENCE_100X";
              if (Math.abs(ratio - 0.01) < 0.000001) return "EVIDENCE_1_OVER_100";
              if (Math.abs(amount * 100 - value) < 0.005) return "EVIDENCE_CENTS_AS_REAIS";
              if (Math.abs(amount - value * 100) < 0.5) return "EVIDENCE_REAIS_AS_CENTS";
              if (Math.abs(ratio) >= 0.1 && Math.abs(ratio) < 10) return "SAME_ORDER_OF_MAGNITUDE";
              if (Math.abs(ratio) >= 10 && Math.abs(ratio) < 10_000) return "SCALE_DIFFERENCE";
              return "OTHER_DIFFERENCE";
            }) : [];
            fieldEvidenceFailureSamples.push({
              page: record.startPage,
              endPage: record.endPage,
              record: record.record,
              field,
              matchingEvidenceCount: matchingEvidence.length,
              evidenceHasExpectedLabel: matchingEvidence.some(evidence => /valor\s+atualizado/i.test(evidence.textSpan)),
              currencyMarkerCount: matchingEvidence.reduce((count, evidence) => count + (evidence.textSpan.match(/R\$/g)?.length ?? 0), 0),
              numericTokenCounts: matchingEvidence.map(evidence => (evidence.textSpan.match(/[0-9][0-9.,]*/g) ?? []).length),
              numericTextStyles: matchingEvidence.map(evidence => moneyTextStyle(evidence.textSpan)),
              numericEvidenceParses: field === "amount" ? matchingEvidence.map(evidence => parseAmount(evidence.textSpan) !== null) : [],
              amountTailParsesToStoredValue: field === "amount" && typeof value === "number" ? matchingEvidence.map(evidence => {
                const label = /valor\s+atualizado\s*:/i.exec(evidence.textSpan);
                const tail = label ? evidence.textSpan.slice(label.index + label[0].length).trim() : "";
                const parsedTail = parseAmount(tail);
                return parsedTail !== null && Math.round(parsedTail * 100) === Math.round(value * 100);
              }) : [],
              amountDifferenceBuckets,
              amountReaisDigitRunFound: field === "amount" && typeof value === "number" ? matchingEvidence.some(evidence => normalizeEvidence(evidence.textSpan).includes(String(Math.round(value)))) : false,
              amountCentsDigitRunFound: field === "amount" && typeof value === "number" ? matchingEvidence.some(evidence => normalizeEvidence(evidence.textSpan).includes(String(Math.round(value * 100)))) : false,
            });
          }
        }
      }
      if (record.numeroProcessoDEPRE) {
        depreOccurrences++;
        const normalizedDepre = normalizeDepreIdentifier(record.numeroProcessoDEPRE).normalized;
        if (!normalizedDepre) {
          depreNormalizationFailures++;
        } else {
          depreCounts.set(normalizedDepre, (depreCounts.get(normalizedDepre) ?? 0) + 1);
          const documents = crossDocumentDepre.get(normalizedDepre) ?? new Map<string, Set<number>>();
          const pages = documents.get(document.documentId) ?? new Set<number>();
          pages.add(record.fieldEvidence.find(evidence => evidence.field === "numeroProcessoDEPRE")?.page ?? record.startPage);
          documents.set(document.documentId, pages);
          crossDocumentDepre.set(normalizedDepre, documents);
        }
      }
      for (const evidence of record.fieldEvidence) {
        const validHeaderEvidence = evidence.source === "REPORT_HEADER"
          && Boolean(headerDebtor)
          && evidence.page === headerDebtor?.page
          && evidence.textSpan === headerDebtor?.textSpan;
        const validRecordEvidence = evidence.source === "DOCUMENT"
          && evidence.page >= record.startPage
          && evidence.page <= record.endPage
          && record.rawText.includes(evidence.textSpan);
        if (!validHeaderEvidence && !validRecordEvidence) {
          invalidEvidenceSpans++;
          const reason = evidence.source === "REPORT_HEADER"
            ? evidence.page !== headerDebtor?.page ? "HEADER_PAGE_MISMATCH" : "HEADER_TEXT_MISMATCH"
            : evidence.page < record.startPage || evidence.page > record.endPage ? "PAGE_OUTSIDE_RECORD" : !record.rawText.includes(evidence.textSpan) ? "SPAN_NOT_IN_RAW_RECORD" : "UNKNOWN";
          const key = `${evidence.field}:${evidence.source}:${reason}`;
          invalidEvidenceReasonCounts[key] = (invalidEvidenceReasonCounts[key] ?? 0) + 1;
          if (invalidEvidenceSamples.length < 12) invalidEvidenceSamples.push({ page: evidence.page, startPage: record.startPage, endPage: record.endPage, field: evidence.field, source: evidence.source, reason, spanChars: evidence.textSpan.length });
        }
      }
      const natureClass = /alimentar/i.test(record.nature) ? "ALIMENTAR" : /outras|comum/i.test(record.nature) ? "OUTRAS_ESPECIES" : "OTHER_OR_EMPTY";
      const sampleReasons: string[] = [];
      if (samples.length < 2) sampleReasons.push("OPENING_RECORD");
      if (!sampledNature.has(natureClass)) sampleReasons.push("NATURE_VARIANT");
      if (record.numeroEPES && !sampledEpesPresent) sampleReasons.push("EPES_PRESENT");
      if (!record.numeroEPES && !sampledEpesAbsent) sampleReasons.push("EPES_ABSENT");
      if (record.attorneys.length > 1 && !sampledMultipleAttorneys) sampleReasons.push("MULTILINE_ATTORNEYS");
      if (record.endPage > record.startPage && !sampledBoundary) sampleReasons.push("PAGE_BOUNDARY");
      if (record.missingOptionalFields.length > 0 && !sampledOptionalMissing) sampleReasons.push("OPTIONAL_FIELDS_MISSING");
      if (record.startPage > 2 && !sampledLaterPage) sampleReasons.push("LATER_PAGE");
      if (record.record % sampleInterval === 0) sampleReasons.push("PERIODIC_10_BUCKET");
      if (samples.length < 10 && sampleReasons.length > 0) {
        const depreEvidence = record.fieldEvidence.some(evidence => evidence.field === "numeroProcessoDEPRE" && evidence.textSpan.includes(record.numeroProcessoDEPRE));
        const debtorEvidence = record.debtorSource === "REPORT_HEADER"
          ? record.fieldEvidence.some(evidence => evidence.field === "devedora" && evidence.source === "REPORT_HEADER")
          : record.fieldEvidence.some(evidence => evidence.field === "debtor");
        samples.push({
          documentId: record.documentId,
          startPage: record.startPage,
          endPage: record.endPage,
          recordNumber: record.record,
          natureClass,
          selectionReasons: sampleReasons,
          depreEvidenceValid: depreEvidence,
          rawContainsParsedDepre: record.rawText.includes(record.numeroProcessoDEPRE),
          hasNature: Boolean(record.nature),
          valueIsParseable: record.amount === null || Number.isFinite(record.amount),
          debtorEvidenceValid: debtorEvidence,
          debtorSource: record.debtorSource,
          attorneyCount: record.attorneys.length,
          evidenceCount: record.fieldEvidence.length,
          evidenceReferencesValid: record.fieldEvidence.every(evidence => evidence.source === "REPORT_HEADER"
            ? Boolean(headerDebtor) && evidence.page === headerDebtor?.page && evidence.textSpan === headerDebtor?.textSpan
            : evidence.page >= record.startPage && evidence.page <= record.endPage && record.rawText.includes(evidence.textSpan)),
          populatedFieldsEvidenceBacked: fieldNames.filter(field => values[field] !== null && values[field] !== "" && !(Array.isArray(values[field]) && !values[field].length)).every(field => {
            const matching = record.fieldEvidence.filter(evidence => evidence.field === fieldEvidenceKey[field]).map(evidence => evidence.textSpan);
            const value = values[field];
            return field === "amount"
              ? typeof value === "number" && matching.some(span => moneyEvidenceMatches(span, value))
              : field === "attorneys"
                ? (value as string[]).every(attorney => matching.some(span => normalizeEvidence(span).includes(normalizeEvidence(attorney))))
                : matching.some(span => normalizeEvidence(span).includes(normalizeEvidence(String(value))));
          }),
        });
        sampledNature.add(natureClass);
        if (record.numeroEPES) sampledEpesPresent = true;
        else sampledEpesAbsent = true;
        if (record.attorneys.length > 1) sampledMultipleAttorneys = true;
        if (record.endPage > record.startPage) sampledBoundary = true;
        if (record.missingOptionalFields.length > 0) sampledOptionalMissing = true;
        if (record.startPage > 2) sampledLaterPage = true;
      }
    },
    onRejected(candidate) {
      rejectionSamples[candidate.reason] = (rejectionSamples[candidate.reason] ?? 0) + 1;
    },
  });

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = pageNumber === 1 ? firstPage : await pdf.getPage(pageNumber);
    const content = pageNumber === 1 ? firstContent : await page.getTextContent();
    const items = pageNumber === 1 ? firstItems : content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item)
      .map(item => ({ text: item.str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) }));
    parser.pushPage(pageNumber, items);
  }

  const summary = parser.finish();
  const duplicateDepreIds = [...depreCounts.values()].filter(count => count > 1).length;
  const duplicateDepreRecords = [...depreCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  depreOccurrencesByDocument.set(document.documentId, depreCounts);
  output.push({
    filename: document.filename,
    documentId: document.documentId,
    documentIdentifier: document.filename,
    sourceUrl: null,
    sourceUrlCaptured: false,
    acquisitionReference: "User-supplied CP_REAL_CAC_PILOT_CORPUS.zip",
    officialReference: null,
    sourceReferenceDate: document.sourceReferenceDate,
    publicationDateCaptured: false,
    sha256Verified: true,
    contentHash: sha256,
    collectedAt: document.collectedAt,
    pagesInManifest: document.pages,
    candidateReference: document.recordsUnvalidated,
    pagesParsed: pdf.numPages,
    pagesMatchManifest: pdf.numPages === document.pages,
    reportHeaderDebtorFound: Boolean(headerDebtor),
    candidateStarts: summary.stats.candidateStarts,
    acceptedRecords: summary.stats.acceptedRecords,
    rejectedCandidates: summary.stats.rejectedCandidates,
    depreOccurrences,
    uniqueDepreIdentifiers: depreCounts.size,
    repeatedDepreOccurrences: depreOccurrences - depreCounts.size - depreNormalizationFailures,
    depreNormalizationFailures,
    rejectionReasons: summary.stats.rejectionReasons,
    spanningRecords: summary.stats.spanningRecords,
    fieldPopulatedCounts: fieldCounts,
    fieldMissingCounts: Object.fromEntries(fieldNames.map(name => [name, summary.stats.acceptedRecords - fieldCounts[name]])),
    duplicateDepreIdsWithinDocument: duplicateDepreIds,
    duplicateDepreRecordsWithinDocument: duplicateDepreRecords,
    invalidEvidenceSpans,
    invalidEvidenceReasonCounts,
    invalidEvidenceSamples,
    fieldEvidenceChecks: evidenceChecks,
    fieldEvidenceFailureSamples,
    samples,
  });
  await loadingTask.destroy();
}

const crossDocumentClusters = [...crossDocumentDepre.entries()]
  .filter(([, documents]) => documents.size > 1)
  .map(([, documents], index) => ({
    clusterIndex: index + 1,
    relationType: "SAME_PROCESSO_DEPRE",
    sourceDocumentIds: [...documents.keys()],
    evidencePagesByDocument: Object.fromEntries([...documents.entries()].map(([id, pages]) => [id, [...pages].sort((a, b) => a - b)])),
  }));
const uniqueDepreIdentifiers = crossDocumentDepre.size;
const depreOccurrences = output.reduce((total, document) => total + Number(document.depreOccurrences), 0);
const depreNormalizationFailures = output.reduce((total, document) => total + Number(document.depreNormalizationFailures), 0);
const repeatedDepreOccurrences = depreOccurrences - uniqueDepreIdentifiers - depreNormalizationFailures;
const duplicateDepreOccurrencesWithinDocuments = output.reduce((total, document) => total + Number(document.repeatedDepreOccurrences), 0);
const repeatedDepreOccurrencesAcrossDocuments = repeatedDepreOccurrences - duplicateDepreOccurrencesWithinDocuments;
const contentHashCounts = new Map<string, number>();
for (const document of output) contentHashCounts.set(String(document.contentHash), (contentHashCounts.get(String(document.contentHash)) ?? 0) + 1);
const documentIdCounts = new Map<string, number>();
for (const document of output) documentIdCounts.set(String(document.documentId), (documentIdCounts.get(String(document.documentId)) ?? 0) + 1);
const documentAudit = {
  pdfCount: output.length,
  uniqueContentHashes: contentHashCounts.size,
  duplicateContentHashReferences: [...contentHashCounts.values()].filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0),
  uniqueDocumentIds: documentIdCounts.size,
  duplicateDocumentIdReferences: [...documentIdCounts.values()].filter(count => count > 1).reduce((sum, count) => sum + count - 1, 0),
  sourceUrlsCaptured: output.filter(document => document.sourceUrlCaptured).length,
  sourceUrlsNotCaptured: output.filter(document => !document.sourceUrlCaptured).length,
};
const depreAudit = {
  pdfCount: output.length,
  depreOccurrences,
  uniqueDepreIdentifiers,
  repeatedDepreOccurrences,
  repeatedDepreOccurrencesWithinDocuments: duplicateDepreOccurrencesWithinDocuments,
  repeatedDepreOccurrencesAcrossDocuments,
  uniqueDepresPresentInMultipleDocuments: crossDocumentClusters.length,
  normalizationFailures: depreNormalizationFailures,
};
const report = summaryOnly
  ? {
      documents: output.map(({ samples, fieldEvidenceFailureSamples, ...summary }) => summary),
      documentAudit,
      depreAudit,
      crossDocumentClusterCount: crossDocumentClusters.length,
      crossDocumentClusterSample: crossDocumentClusters.slice(0, 25),
    }
  : { documents: output, documentAudit, depreAudit, crossDocumentClusters };
console.log(JSON.stringify(report, null, 2));
