import { describe, expect, it } from "vitest";
import {
  extractStructuralEvidence,
  searchDocumentEvidence,
  compareDocuments
} from "./document-evidence-engine";

describe("Document Evidence & Retrieval Engine (CP 2.4.3)", () => {
  const pagesText = [
    "Relatório DEPRE nº 0032722-57.2014.8.26.0500. Beneficiário titular: JOÃO SILVA FERREIRA. Advogado: Dr. Carlos Eduardo OAB/SP 123456.",
    "Termo de Cessão de Crédito em favor do FUNDO DE INVESTIMENTO CP PRECATÓRIOS FIDC.",
    "Certidão de Óbito e Habilitação de Herdeiros (Sucessão / Espólio de Antonio Pereira)."
  ];

  it("extracts structural evidence from page text", () => {
    const evidence = extractStructuralEvidence("doc-1", "org-1", pagesText);
    expect(evidence.length).toBeGreaterThan(0);
    expect(evidence.some(e => e.detectedKeywords.includes("CREDOR"))).toBe(true);
    expect(evidence.some(e => e.detectedKeywords.includes("CESSAO"))).toBe(true);
    expect(evidence.some(e => e.detectedKeywords.includes("SUCESSAO"))).toBe(true);
  });

  it("executes search engine with coverage disclosure and attorney protection", () => {
    const searchResult = searchDocumentEvidence("doc-1", "org-1", pagesText, "cessão", "CESSION_LOOKUP");
    expect(searchResult.query).toBe("cessão");
    expect(searchResult.coverage.totalPages).toBe(3);
    expect(searchResult.coverage.pagesAnalyzed).toBe(3);
    expect(searchResult.coverage.analyzedScopeNote).toContain("3 de 3 páginas analisadas");
    expect(searchResult.cessionResult).toBe("FOUND");
    expect(searchResult.currentHolderCandidate).toBe("CESSIONARIO_CANDIDATE");
  });

  it("detects succession lookup accurately", () => {
    const searchResult = searchDocumentEvidence("doc-1", "org-1", pagesText, "herdeiros", "SUCCESSION_LOOKUP");
    expect(searchResult.successionResult).toBe("FOUND");
  });

  it("compares two documents side-by-side deterministically", async () => {
    const pagesA = ["Processo DEPRE nº 0032722-57.2014.8.26.0500. Valor R$ 100.000,00."];
    const pagesB = ["Processo DEPRE nº 0032722-57.2014.8.26.0500. Valor R$ 150.000,00."];

    const comp = await compareDocuments("doc-A", pagesA, "doc-B", pagesB);
    expect(comp.deterministicDifferences.length).toBe(1);
    expect(comp.deterministicDifferences[0].field).toBe("Valor Mensionado");
    expect(comp.deterministicDifferences[0].valueA).toContain("100.000");
    expect(comp.deterministicDifferences[0].valueB).toContain("150.000");
  });
});
