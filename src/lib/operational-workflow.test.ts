import { describe, expect, it } from "vitest";
import { calculatePricing, canTransition, createDefaultWorkflow, initialInventoryOrigin, inventoryMetadataForSources, nextActionFor, summarizeEvidence } from "./operational-workflow";

describe("workflow operacional", () => {
  it("bloqueia transições arbitrárias", () => {
    expect(canTransition("NEW", "TRIAGE")).toBe(true);
    expect(canTransition("NEW", "COMPLETED")).toBe(false);
    expect(canTransition("NEGOTIATION", "ACCEPTED")).toBe(true);
  });
  it("calcula preço de forma determinística e explicável", () => {
    expect(calculatePricing({ grossAmount: 500000, deductions: 50000, encumbrances: 25000, transactionCosts: 5000, targetMarginPercent: 20 }))
      .toEqual({ availableAmount: 425000, offerAmount: 335000 });
  });
  it("prioriza divergência crítica na próxima ação", () => {
    const workflow = createDefaultWorkflow();
    workflow.validations.push({ id: crypto.randomUUID(), check: "CPF", severity: "CRITICAL", status: "FAILED", explanation: "CPF diverge do documento." });
    expect(nextActionFor(workflow)).toBe("Resolver divergência crítica");
  });
  it("resume a evidência do fluxo para conferência analítica", () => {
    const workflow = createDefaultWorkflow();
    workflow.evidence.push({
      id: crypto.randomUUID(),
      source: "TJSP / DEPRE",
      sourceType: "OFFICIAL",
      reference: "https://www.tjsp.jus.br/precatorios/123",
      retrievedAt: new Date().toISOString(),
      confidence: 88,
      status: "CONFIRMADO",
      notes: "Registro confirmado por fonte oficial.",
    });
    expect(summarizeEvidence(workflow.evidence)).toEqual([
      {
        source: "TJSP / DEPRE",
        sourceType: "OFFICIAL",
        reference: "https://www.tjsp.jus.br/precatorios/123",
        confidence: 88,
        status: "CONFIRMADO",
        summary: "TJSP / DEPRE · https://www.tjsp.jus.br/precatorios/123 · 88% · CONFIRMADO",
      },
    ]);
  });
  it("marca a base importada dos 73 como disponível com validação IA pendente", () => {
    expect(inventoryMetadataForSources([
      "TJSP/DEPRE · Pacote 73",
      "CP_pacote_completo_73_DEPREs.xlsx",
    ])).toEqual({
      origin: "INITIAL_73",
      availability: "AVAILABLE",
      aiValidation: "PENDING",
      aiConfidence: null,
      divergenceAlert: "",
    });
    expect(initialInventoryOrigin).toBe("BASE INICIAL — 73 DEPREs");
  });
  it("não classifica outras origens como parte do estoque inicial", () => {
    expect(inventoryMetadataForSources(["TJSP · Lista Geral"]).availability).toBe("UNDER_REVIEW");
  });
  it("preserva o resultado e a confiança da IA em leituras futuras", () => {
    expect(inventoryMetadataForSources(["TJSP/DEPRE · Pacote 73"], {
      origin: "INITIAL_73",
      availability: "UNDER_REVIEW",
      aiValidation: "DIVERGENCE",
      aiConfidence: 72,
      divergenceAlert: "Credor diferente na fonte consultada",
    })).toEqual({
      origin: "INITIAL_73",
      availability: "AVAILABLE",
      aiValidation: "DIVERGENCE",
      aiConfidence: 72,
      divergenceAlert: "Credor diferente na fonte consultada",
    });
  });
});
