import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { enrichOpportunityFromEvidence } from "./opportunity-enrichment";
import { createOperation, applyOperationsSchema, loadDemoOperation } from "./operations";
import { initializeAutonomousAcquisition } from "./autonomous-acquisition";
import { createDefaultWorkflow } from "./operational-workflow";
import { applySchemaMigrations } from "./schema-migrations";

const db = createClient({ url: ":memory:" });
const organizationId = "test-org-enrich";
const actorUserId = "tester";

describe("Opportunity Enrichment (Phase 8)", () => {
  beforeEach(async () => {
    await applySchemaMigrations(db);
  });

  it("should fail for demo operations", async () => {
    const demo = await loadDemoOperation(db, organizationId);
    await expect(enrichOpportunityFromEvidence(demo.id, organizationId, actorUserId, db))
      .rejects.toThrow("ENRICHMENT_DEMO_OPERATION_FORBIDDEN");
  });

  it("should enrich an operation with no evidence deterministically", async () => {
    const wf = createDefaultWorkflow(0);
    wf.credit.numeroProcessoDEPRE = "0000000-00.0000.0.00.0000";
    wf.client.name = "Test Client";

    const op = await createOperation({
      title: "Test Op",
      debtor: "Município X",
      tribunal: "TJSP",
      process: "",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    const result = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);
    expect(result.depre).toBe("0000000-00.0000.0.00.0000");
    expect(result.titularStatus).toBe("UNRESOLVED");
    expect(result.qualifyingEvidenceCount).toBe(0);
    expect(result.readyForAnalyst).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.blockers).toContain("DOCUMENTATION_BELOW_2_OF_2");
  });

  it("should be idempotent on repeated execution", async () => {
    const wf = createDefaultWorkflow(50000);
    wf.credit.numeroProcessoDEPRE = "1111111-11.1111.1.11.1111";
    wf.client.name = "Idempotency Test";

    const op = await createOperation({
      title: "Idem Test",
      debtor: "Município Y",
      tribunal: "TJSP",
      process: "",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    const result1 = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);
    const result2 = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);

    expect(result1.blockers).toEqual(result2.blockers);
    expect(result1.readyForAnalyst).toBe(result2.readyForAnalyst);
    expect(result1.qualifyingEvidenceCount).toBe(result2.qualifyingEvidenceCount);

    // Only 1 audit entry (idempotent)
    const audits = await db.execute({
      sql: "SELECT * FROM audit_logs WHERE organization_id = ? AND entity_id = ? AND action = 'OPPORTUNITY_UPDATED'",
      args: [organizationId, op.id],
    });
    expect(audits.rows.length).toBe(1);
  });

  it("should fail for missing DEPRE", async () => {
    const wf = createDefaultWorkflow(0);
    wf.credit.numeroProcessoDEPRE = "";
    wf.client.name = "No DEPRE";

    const op = await createOperation({
      title: "No DEPRE Test",
      debtor: "Município Z",
      tribunal: "TJSP",
      process: "",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    await expect(enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db))
      .rejects.toThrow("ENRICHMENT_DEPRE_REQUIRED");
  });

  it("should not produce false READY_FOR_ANALYST without all gates", async () => {
    const wf = createDefaultWorkflow(100000);
    wf.credit.numeroProcessoDEPRE = "2222222-22.2222.2.22.2222";
    wf.client.name = "High Value Client";
    wf.client.phone = "(11) 99999-9999";
    wf.client.email = "test@example.com";
    wf.credit.legalRepName = "Dr. Advogado";
    wf.credit.legalRepOab = "SP123456";
    wf.credit.valueDate = "2024-01-15";
    wf.credit.originProcessNumber = "3333333-33.3333.3.33.3333";

    const op = await createOperation({
      title: "High Value Test",
      debtor: "Município W",
      tribunal: "TJSP",
      process: "3333333-33.3333.3.33.3333",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    const result = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);
    // Even with all fields populated, no 2/2 evidence => not ready
    expect(result.readyForAnalyst).toBe(false);
    expect(result.blockers).toContain("DOCUMENTATION_BELOW_2_OF_2");
    expect(result.blockers).toContain("TITULAR_NOT_CONFIRMED");
  });

  it("should enforce tenant isolation", async () => {
    const wf = createDefaultWorkflow(0);
    wf.credit.numeroProcessoDEPRE = "4444444-44.4444.4.44.4444";
    wf.client.name = "Tenant A";

    const op = await createOperation({
      title: "Tenant A Op",
      debtor: "Município A",
      tribunal: "TJSP",
      process: "",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, "tenant-a");

    await expect(enrichOpportunityFromEvidence(op.id, "tenant-b", actorUserId, db))
      .rejects.toThrow("ENRICHMENT_OPERATION_NOT_FOUND");
  });

  it("should preserve multiple beneficiaries without collapsing", async () => {
    const wf = createDefaultWorkflow(80000);
    wf.credit.numeroProcessoDEPRE = "5555555-55.5555.5.55.5555";
    wf.client.name = "Multi Beneficiary";
    wf.client.beneficiaries = [
      {
        id: crypto.randomUUID(),
        depre: "5555555-55.5555.5.55.5555",
        name: "Person A",
        role: "TITULAR",
        status: "UNVERIFIED_IMPORT",
        source: "import",
        sourceUrl: "",
        sourceType: "IMPORTED_SNAPSHOT",
        provider: "manual",
        sourceId: "s1",
        route: "import",
        sourceStatus: "NOT_ATTEMPTED",
        documentIdentifier: "",
        reference: "ref-a",
        collectedAt: new Date().toISOString(),
        evidenceId: "",
        evidenceStrength: "",
        lawyerName: "",
        lawyerOab: "",
        lawyerSource: "",
        lawyerSourceUrl: "",
        lawyerSourceStatus: "",
        context: "",
      },
      {
        id: crypto.randomUUID(),
        depre: "5555555-55.5555.5.55.5555",
        name: "Person B",
        role: "BENEFICIARIO",
        status: "UNVERIFIED_IMPORT",
        source: "import",
        sourceUrl: "",
        sourceType: "IMPORTED_SNAPSHOT",
        provider: "manual",
        sourceId: "s2",
        route: "import",
        sourceStatus: "NOT_ATTEMPTED",
        documentIdentifier: "",
        reference: "ref-b",
        collectedAt: new Date().toISOString(),
        evidenceId: "",
        evidenceStrength: "",
        lawyerName: "",
        lawyerOab: "",
        lawyerSource: "",
        lawyerSourceUrl: "",
        lawyerSourceStatus: "",
        context: "",
      },
    ];

    const op = await createOperation({
      title: "Multi Beneficiary Test",
      debtor: "Município M",
      tribunal: "TJSP",
      process: "",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    const result = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);
    expect(result.beneficiaryCount).toBe(2);
    expect(result.blockers).toContain("MULTIPLE_BENEFICIARIES_UNRESOLVED");
    expect(result.titularStatus).toBe("UNRESOLVED");
  });

  it("should not confirm value when R$0 default", async () => {
    const wf = createDefaultWorkflow(0);
    wf.credit.numeroProcessoDEPRE = "6666666-66.6666.6.66.6666";
    wf.client.name = "Zero Value";

    const op = await createOperation({
      title: "Zero Value Test",
      debtor: "Município V",
      tribunal: "TJSP",
      process: "",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    const result = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);
    expect(result.valueStatus).toBe("MISSING");
    expect(result.blockers).toContain("VALUE_NOT_CONFIRMED");
  });

  it("should distinguish DEPRE from originating process", async () => {
    const wf = createDefaultWorkflow(75000);
    wf.credit.numeroProcessoDEPRE = "7777777-77.7777.7.77.7777";
    wf.credit.originProcessNumber = "8888888-88.8888.8.88.8888";
    wf.client.name = "Process Distinction";

    const op = await createOperation({
      title: "Process Distinction Test",
      debtor: "Município P",
      tribunal: "TJSP",
      process: "8888888-88.8888.8.88.8888",
      owner: "tester",
      source: "Manual",
      workflow: wf,
    }, db, organizationId);

    const result = await enrichOpportunityFromEvidence(op.id, organizationId, actorUserId, db);
    // DEPRE is the enrichment key, not the originating process
    expect(result.depre).toBe("7777777-77.7777.7.77.7777");
    // Process is confirmed because originProcessNumber exists
    expect(result.processStatus).toBe("CONFIRMED");
  });
});
