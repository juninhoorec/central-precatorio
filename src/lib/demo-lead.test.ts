import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { evaluateLead } from "./lead-qualification";
import { DEMO_LEAD } from "./demo-fixture";
import { DatabaseStorageAdapter } from "./document-storage";
import { listPdfAnalyses } from "./pdf-analysis";
import { createOperation, listOperations, loadDemoOperation, resetDemoOperations, updateOperation } from "./operations";

describe("lead sintético demonstrativo", () => {
  it("persiste os dados e evidências, qualifica, converte no mesmo registro e preserva produção no reset", async () => {
    const db = createClient({ url: ":memory:" });
    const organizationId = "demo-lead-test";
    const production = await createOperation({
      title: "Lead de produção de teste",
      debtor: "Devedora de teste",
      tribunal: "TJSP",
      process: "PROC-REAL-ISOLADO",
      owner: "Teste",
      source: "Importação",
      stage: "Entrada",
      nominal: 50_000,
      notes: "Registro não demonstrativo.",
      tasks: [],
      checks: [],
      proposals: [],
      isDemo: false,
    }, db, organizationId, "tester");

    const created = await loadDemoOperation(db, organizationId, "tester");
    const persisted = (await listOperations(db, organizationId)).find((item) => item.id === created.id)!;
    const credit = persisted.workflow.credit;
    expect(persisted.isDemo).toBe(true);
    expect(persisted.workflow.client.name).toBe("João da Silva — DEMONSTRAÇÃO");
    expect(credit.numeroProcessoDEPRE).toBe("DEMO-DEPRE-0001");
    expect(credit.originProcessNumber).toBe("DEMO-PROC-0001");
    expect(credit.epesNumber).toBe("DEMO-EP-001");
    expect(persisted.nominal).toBe(187450.32);
    expect(credit.nature).toBe("Alimentar");
    expect(persisted.debtor).toBe("Fazenda Demonstrativa do Estado de São Paulo");
    expect(credit.valueDate).toBeTruthy();
    expect(credit.checkedAt).toBeTruthy();
    expect(credit.sourceName).toBe("Fonte sintética CP — demonstração");
    expect(persisted.workflow.evidence).toHaveLength(1);
    expect(persisted.workflow.evidence[0]).toMatchObject({
      source: "Fonte sintética CP — demonstração",
      reference: "DEMO-CAC-001",
      confidence: 100,
      status: "COMPATÍVEL",
      sourceType: "MANUAL",
    });
    expect(persisted.workflow.evidence[0].notes).toContain(DEMO_LEAD.disclaimer);
    expect(persisted.workflow.evidence[0].notes).toContain("Trecho:");
    expect(persisted.workflow.creditorResolution).toMatchObject({
      state: "CREDOR_IDENTIFICADO",
      confidence: "ALTA",
      currentHolderStatus: "CURRENT_HOLDER_CONFIRMED",
    });
    expect(persisted.workflow.queryStatus).toBe("MANUAL_REQUIRED");
    expect(persisted.workflow.legalStatus).toBe("REMARKS");
    expect(persisted.workflow.legalReviews[0]).toMatchObject({
      status: "APPROVED_WITH_REMARKS",
      reviewer: "Revisão demonstrativa",
    });
    expect(persisted.workflow.legalReviews[0].observations).toContain("SEM VALIDADE REAL");
    expect(persisted.workflow.pricingScenarios[0]).toMatchObject({
      name: "BASE",
      grossAmount: 187450.32,
      deductions: 5000,
      encumbrances: 2500,
      transactionCosts: 1500,
      availableAmount: 179950.32,
      offerAmount: 142460.26,
    });
    expect(persisted.workflow.pricingScenarios[0].assumptions).toContain("CENÁRIO SINTÉTICO");

    const storage = new DatabaseStorageAdapter(db);
    const demoDocuments = await storage.list(created.id, organizationId);
    expect(demoDocuments).toHaveLength(1);
    expect(demoDocuments[0]).toMatchObject({
      name: "Documento demonstrativo — identificação do crédito.pdf",
      status: "QUARANTINED",
      scanStatus: "DEMO_SCAN",
      category: "PRECATORIO",
    });
    expect(demoDocuments[0].reviewerNotes).toContain("DOCUMENTO DE DEMONSTRAÇÃO — SEM VALIDADE REAL");
    const analysis = await listPdfAnalyses(created.id, organizationId, db);
    expect(analysis).toHaveLength(1);
    expect(analysis[0]).toMatchObject({
      status: "TEXT_EXTRACTED",
      matchStatus: "MATCH",
      autoCategory: "PRECATORIO",
    });
    expect(analysis[0].fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "depreReference", value: expect.stringContaining("DEMO-DEPRE-0001") }),
      expect.objectContaining({ field: "currency", value: "R$ 187.450,32" }),
    ]));

    const qualification = evaluateLead({
      type: credit.creditType,
      amount: persisted.nominal,
      debtor: persisted.debtor,
      tribunal: persisted.tribunal,
      process: persisted.process,
      workflow: persisted.workflow,
      checkedAt: credit.checkedAt,
    }, undefined, new Date(credit.checkedAt));
    expect(qualification.status).toBe("QUALIFICADO_COM_PENDENCIAS");
    expect(qualification.criteria.find((criterion) => criterion.key === "profile")?.ok).toBe(true);

    const converted = await updateOperation({
      ...persisted,
      workflow: { ...persisted.workflow, stage: "TRIAGE" },
    }, db, organizationId, "tester");
    expect(converted.status).toBe("updated");
    if (converted.status === "updated") {
      expect(converted.operation.id).toBe(created.id);
      expect(converted.operation.isDemo).toBe(true);
      expect(converted.operation.workflow.evidence).toEqual(persisted.workflow.evidence);
      expect(converted.operation.workflow.credit.numeroProcessoDEPRE).toBe("DEMO-DEPRE-0001");
      expect(converted.operation.workflow.creditorResolution.state).toBe("CREDOR_IDENTIFICADO");
      expect(converted.operation.source).toBe("Fonte sintética CP — demonstração");
    }

    expect((await resetDemoOperations(db, organizationId)).removed).toBe(1);
    expect(await listPdfAnalyses(created.id, organizationId, db)).toHaveLength(0);
    const remaining = await listOperations(db, organizationId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(production.id);
    expect(remaining[0].isDemo).toBe(false);
    await db.close();
  });
});