import { describe, expect, it } from "vitest";
import { calculatePricing, canTransition, createDefaultWorkflow, initialInventoryOrigin, inventoryMetadataForSources, nextActionFor, operationalWorkflowSchema, summarizeEvidence } from "./operational-workflow";

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
  it("preserva beneficiários distintos ligados ao mesmo DEPRE e às próprias referências", () => {
    const workflow = createDefaultWorkflow();
    const depre = "0038850-88.2017.8.26.0500";
    const source = {
      depre,
      role: "TITULAR" as const,
      status: "HISTORICAL_CONFIRMED" as const,
      source: "Diário Oficial de Campinas",
      sourceUrl: "https://portal-adm.campinas.sp.gov.br/sites/default/files/publicacoes-dom/dom/1882658638.pdf",
      sourceType: "OFFICIAL_PUBLICATION" as const,
      provider: "ASSISTED_OFFICIAL_WEB",
      sourceId: "campinas-diario-oficial",
      route: "official-pdf",
      sourceStatus: "SUCCESS" as const,
      collectedAt: "2026-10-04T00:00:00.000Z",
      evidenceId: "86e168a4-4cdc-4709-a20b-9543e27a16e1",
      evidenceStrength: "MEDIUM" as const,
      lawyerName: "Daniel Krahembuhl Wanderley",
      lawyerOab: "",
      lawyerSource: "",
      lawyerSourceUrl: "",
      lawyerSourceStatus: "" as const,
      context: "Registro histórico; não confirma titularidade atual.",
    };
    workflow.client.beneficiaries = [
      { ...source, id: crypto.randomUUID(), name: "Lúcia Helena Silveira de Freitas Blandy", documentIdentifier: "PMC.2021.00051374-90", reference: "PMC.2021.00051374-90" },
      { ...source, id: crypto.randomUUID(), name: "Nelson Barthelson", documentIdentifier: "PMC.2021.00051365-07", reference: "PMC.2021.00051365-07" },
    ];

    const parsed = operationalWorkflowSchema.parse(workflow);
    expect(parsed.client.beneficiaries.map((item) => item.name)).toEqual([
      "Lúcia Helena Silveira de Freitas Blandy",
      "Nelson Barthelson",
    ]);
    expect(parsed.client.beneficiaries.every((item) => item.depre === depre)).toBe(true);
  });
  it("aceita workflows persistidos antes da lista de beneficiários", () => {
    const legacy = JSON.parse(JSON.stringify(createDefaultWorkflow())) as Record<string, unknown>;
    delete (legacy.client as Record<string, unknown>).beneficiaries;
    expect(operationalWorkflowSchema.parse(legacy).client.beneficiaries).toEqual([]);
  });
  it("preserva o papel literal de credor sem convertê-lo em titular atual", () => {
    const workflow = createDefaultWorkflow();
    workflow.client.beneficiaries.push({
      id: crypto.randomUUID(), depre: "0002075-74.2017.8.26.0500", name: "Elson de Souza Moura",
      role: "CREDOR", status: "HISTORICAL_CONFIRMED", source: "Diário Oficial de Guarulhos",
      sourceUrl: "https://www.guarulhos.sp.gov.br/diario-oficial/uploads/pdf/1325059861.pdf",
      sourceType: "OFFICIAL_PUBLICATION", provider: "OFFICIAL_PDF_FETCH", sourceId: "guarulhos-diario-oficial",
      route: "pdfjs-exact-depre-scan", sourceStatus: "SUCCESS", documentIdentifier: "Edital 002/2024-SF",
      reference: "p. 42; DEPRE exato; credor provisoriamente habilitado", collectedAt: new Date().toISOString(),
      evidenceId: crypto.randomUUID(), evidenceStrength: "MEDIUM", lawyerName: "", lawyerOab: "",
      lawyerSource: "", lawyerSourceUrl: "", lawyerSourceStatus: "", context: "Status histórico; atual não confirmado.",
    });
    expect(operationalWorkflowSchema.parse(workflow).client.beneficiaries[0].role).toBe("CREDOR");
    expect(workflow.creditorResolution.currentHolderStatus).toBe("CURRENT_HOLDER_NOT_CONFIRMED");
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
