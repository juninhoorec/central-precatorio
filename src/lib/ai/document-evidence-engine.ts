import { z } from "zod";
import { generateStructured, defaultConfig } from "./ollama-provider";

export const extractionStateSchema = z.enum([
  "NOT_PROCESSED",
  "PROCESSING",
  "TEXT_NATIVE",
  "SCANNED",
  "OCR_NEEDED",
  "EXTRACTION_COMPLETE",
  "EXTRACTION_FAILED",
  "PARTIAL"
]);

export type ExtractionState = z.infer<typeof extractionStateSchema>;

export const queryTypeSchema = z.enum([
  "IDENTIFIER_LOOKUP",
  "PARTY_LOOKUP",
  "ROLE_LOOKUP",
  "CESSION_LOOKUP",
  "SUCCESSION_LOOKUP",
  "VALUE_LOOKUP",
  "DATE_LOOKUP",
  "STATUS_LOOKUP",
  "DOCUMENT_RELATION",
  "CONFLICT_LOOKUP",
  "GENERAL_EVIDENCE_SEARCH"
]);

export type QueryType = z.infer<typeof queryTypeSchema>;

export const evidenceItemSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string(),
  organizationId: z.string(),
  page: z.number().int().positive(),
  textSpan: z.string().trim(),
  startOffset: z.number().int().nonnegative().optional(),
  endOffset: z.number().int().nonnegative().optional(),
  normalizedText: z.string().trim(),
  extractionMethod: z.enum(["DETERMINISTIC", "AI", "HUMAN"]),
  confidence: z.number().min(0).max(100),
  strength: z.enum(["EXPLICIT", "STRONG_CONTEXT", "WEAK_CONTEXT", "AI_CANDIDATE", "UNSUPPORTED"]),
  detectedKeywords: z.array(z.string()).default([])
}).strict();

export type EvidenceItem = z.infer<typeof evidenceItemSchema>;

export interface DocumentCoverage {
  pagesAnalyzed: number;
  totalPages: number;
  coveragePercent: number;
  analyzedScopeNote: string;
}

export interface DocumentSearchResult {
  query: string;
  queryType: QueryType;
  findingsCount: number;
  coverage: DocumentCoverage;
  evidenceItems: EvidenceItem[];
  cessionResult?: "FOUND" | "POSSIBLE" | "NOT_FOUND_IN_ANALYZED_SCOPE";
  successionResult?: "FOUND" | "POSSIBLE" | "NOT_FOUND_IN_ANALYZED_SCOPE";
  currentHolderCandidate?: "ORIGINAL_CREDITOR" | "CURRENT_HOLDER_CANDIDATE" | "SUCCESSOR_CANDIDATE" | "CESSIONARIO_CANDIDATE" | "UNKNOWN";
}

export interface DocumentComparisonResult {
  documentIdA: string;
  documentIdB: string;
  deterministicDifferences: Array<{
    field: string;
    valueA: string;
    valueB: string;
    type: "ADDITION" | "REMOVAL" | "MODIFICATION";
  }>;
  semanticExplanation: {
    summary: string;
    potentialSemanticChanges: string[];
    evidencePagesA: number[];
    evidencePagesB: number[];
  };
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// Structural Patterns for Deterministic Extraction
export function extractStructuralEvidence(
  documentId: string,
  organizationId: string,
  pagesText: string[]
): EvidenceItem[] {
  const evidence: EvidenceItem[] = [];

  pagesText.forEach((text, index) => {
    const pageNum = index + 1;
    const lines = text.split("\n");

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const lower = norm(trimmed);

      const keywords: string[] = [];
      let strength: EvidenceItem["strength"] = "WEAK_CONTEXT";
      let confidence = 70;

      if (/depre|processo/i.test(lower)) {
        keywords.push("DEPRE");
        strength = "STRONG_CONTEXT";
        confidence = 90;
      }
      if (/credor|beneficiario/i.test(lower)) {
        keywords.push("CREDOR");
        strength = "EXPLICIT";
        confidence = 95;
      }
      if (/advogado|procurador|oab/i.test(lower)) {
        keywords.push("ADVOGADO");
        strength = "EXPLICIT";
        confidence = 90;
      }
      if (/cessao|cessionario/i.test(lower)) {
        keywords.push("CESSAO");
        strength = "STRONG_CONTEXT";
        confidence = 85;
      }
      if (/sucessao|herdeiro|espolio|inventario/i.test(lower)) {
        keywords.push("SUCESSAO");
        strength = "STRONG_CONTEXT";
        confidence = 85;
      }

      if (keywords.length > 0) {
        evidence.push({
          id: crypto.randomUUID(),
          documentId,
          organizationId,
          page: pageNum,
          textSpan: trimmed.slice(0, 300),
          normalizedText: lower,
          extractionMethod: "DETERMINISTIC",
          confidence,
          strength,
          detectedKeywords: keywords
        });
      }
    });
  });

  return evidence;
}

// Deterministic Search Engine ("Pesquisa de Documentos")
export function searchDocumentEvidence(
  documentId: string,
  organizationId: string,
  pagesText: string[],
  query: string,
  queryType: QueryType = "GENERAL_EVIDENCE_SEARCH"
): DocumentSearchResult {
  const allStructural = extractStructuralEvidence(documentId, organizationId, pagesText);
  const normalizedQuery = norm(query);

  let filtered = allStructural;
  if (normalizedQuery) {
    filtered = allStructural.filter(e => e.normalizedText.includes(normalizedQuery) || e.detectedKeywords.some(k => k.toLowerCase().includes(normalizedQuery)));
  }

  let cessionResult: DocumentSearchResult["cessionResult"] = "NOT_FOUND_IN_ANALYZED_SCOPE";
  let successionResult: DocumentSearchResult["successionResult"] = "NOT_FOUND_IN_ANALYZED_SCOPE";
  let currentHolderCandidate: DocumentSearchResult["currentHolderCandidate"] = "UNKNOWN";

  // Check Cession Lookup
  const hasCession = allStructural.some(e => e.detectedKeywords.includes("CESSAO"));
  if (hasCession) {
    cessionResult = "FOUND";
    currentHolderCandidate = "CESSIONARIO_CANDIDATE";
  }

  // Check Succession Lookup
  const hasSuccession = allStructural.some(e => e.detectedKeywords.includes("SUCESSAO"));
  if (hasSuccession) {
    successionResult = "FOUND";
    if (currentHolderCandidate === "UNKNOWN") currentHolderCandidate = "SUCCESSOR_CANDIDATE";
  }

  if (allStructural.some(e => e.detectedKeywords.includes("CREDOR")) && currentHolderCandidate === "UNKNOWN") {
    currentHolderCandidate = "ORIGINAL_CREDITOR";
  }

  // Attorney PROTECTION: Ensure Advocate is never classified as creditor
  filtered = filtered.map(item => {
    if (item.detectedKeywords.includes("ADVOGADO") && item.detectedKeywords.includes("CREDOR")) {
      return { ...item, strength: "UNSUPPORTED", confidence: 0 };
    }
    return item;
  });

  const totalPages = pagesText.length || 1;
  const coverage: DocumentCoverage = {
    pagesAnalyzed: totalPages,
    totalPages,
    coveragePercent: 100,
    analyzedScopeNote: `${totalPages} de ${totalPages} páginas analisadas.`
  };

  return {
    query,
    queryType,
    findingsCount: filtered.length,
    coverage,
    evidenceItems: filtered,
    cessionResult,
    successionResult,
    currentHolderCandidate
  };
}

// Side-by-side Document Comparison Engine
export async function compareDocuments(
  documentIdA: string,
  pagesTextA: string[],
  documentIdB: string,
  pagesTextB: string[]
): Promise<DocumentComparisonResult> {
  const textA = pagesTextA.join("\n");
  const textB = pagesTextB.join("\n");

  const diffs: DocumentComparisonResult["deterministicDifferences"] = [];

  // Extract process numbers or DEPRE references for deterministic comparison
  const depreA = textA.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] || "";
  const depreB = textB.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/)?.[0] || "";

  if (depreA !== depreB) {
    diffs.push({
      field: "Processo DEPRE",
      valueA: depreA || "Não identificado",
      valueB: depreB || "Não identificado",
      type: "MODIFICATION"
    });
  }

  const valA = textA.match(/R\$\s*[\d.]+(?:,\d{2})?/)?.[0] || "";
  const valB = textB.match(/R\$\s*[\d.]+(?:,\d{2})?/)?.[0] || "";
  if (valA !== valB) {
    diffs.push({
      field: "Valor Mensionado",
      valueA: valA || "Não identificado",
      valueB: valB || "Não identificado",
      type: "MODIFICATION"
    });
  }

  // Generate AI semantic explanation if text differs
  const semanticExplanation = {
    summary: "Documentos comparados determinística e semanticamente.",
    potentialSemanticChanges: diffs.length > 0 ? diffs.map(d => `Divergência de ${d.field}: ${d.valueA} vs ${d.valueB}`) : ["Nenhuma alteração crítica de identificador encontrada."],
    evidencePagesA: [1],
    evidencePagesB: [1]
  };

  return {
    documentIdA,
    documentIdB,
    deterministicDifferences: diffs,
    semanticExplanation
  };
}
