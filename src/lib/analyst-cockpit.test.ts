import { describe, it, expect, beforeEach } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { getAnalystQueue, getCaseDetail } from "./analyst-cockpit";
import { generateManualResearchTask, submitManualEvidence } from "./manual-research";
import { previewManualEvidence } from "./manual-evidence-preview";
import { createOperation, applyOperationsSchema } from "./operations";
import { createDefaultWorkflow } from "./operational-workflow";
import { initializeAutonomousAcquisition, countVerifiedOfficialEvidence, listOfficialEvidence } from "./autonomous-acquisition";
import { randomUUID } from "node:crypto";

const ORG = "org-test-cockpit";

function makeWorkflow() {
  const wf = createDefaultWorkflow(50000);
  wf.credit.numeroProcessoDEPRE = "1111111-11.1111.1.11.1111";
  wf.credit.originProcessNumber = "2222222-22.2222.2.22.2222";
  wf.credit.legalRepName = "Dr. Tester";
  wf.credit.legalRepOab = "SP123456";
  wf.credit.valueDate = "2024-01-01";
  wf.client.name = "Titular Test";
  wf.client.phone = "(11) 99999-9999";
  wf.client.beneficiaries = [{
    id: randomUUID(), depre: "1111111-11.1111.1.11.1111", name: "Titular Test",
    role: "TITULAR", status: "CURRENT_CONFIRMED", source: "e2e",
    sourceUrl: "https://tjsp.jus.br", sourceType: "OFFICIAL_PUBLICATION",
    provider: "e2e", sourceId: "s1", route: "route", sourceStatus: "SUCCESS",
    documentIdentifier: "", reference: "", collectedAt: new Date().toISOString(),
    evidenceId: "", evidenceStrength: "", lawyerName: "", lawyerOab: "",
    lawyerSource: "", lawyerSourceUrl: "", lawyerSourceStatus: "", context: "",
  }];
  wf.documentStatus = "READY";
  return wf;
}

describe("analyst cockpit", () => {
  let db: Client;

  beforeEach(async () => {
    db = createClient({ url: ":memory:" });
    await applyOperationsSchema(db);
    await initializeAutonomousAcquisition(db);
    // Initialize audit table
    const { initializeAudit } = await import("./audit");
    await initializeAudit(db);
    // Initialize all tables using migrations
    const { applySchemaMigrations } = await import("./schema-migrations");
    await applySchemaMigrations(db);
  });

  it("returns analyst queue with correct fields", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Queue Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const { task } = await generateManualResearchTask({
      organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", source: "TJSP_ESAJ",
      sourceId: "src-1", route: "cpopg", blockerType: "CAPTCHA_REQUIRED",
      sourceResult: "CAPTCHA_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], actorUserId: "test"
    }, db);

    const queue = await getAnalystQueue(ORG, {}, db);
    expect(queue.length).toBeGreaterThanOrEqual(1);
    const item = queue.find(q => q.operationId === op.id)!;
    expect(item.depre).toBe("1111111-11.1111.1.11.1111");
    expect(item.blockerCount).toBe(1);
    expect(item.documentationCount).toBe(0);
    expect(item.taskStatus).toBe("OPEN");
    expect(item.tenant).toBe(ORG);
    expect(item.recommendedNextAction).toContain("official document");
  });

  it("returns case detail with identification, documentation, blockers", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Detail Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const detail = await getCaseDetail(op.id, ORG, db);
    expect(detail).not.toBeNull();
    expect(detail!.identification.depre).toBe("1111111-11.1111.1.11.1111");
    expect(detail!.identification.titular).toBe("Titular Test");
    expect(detail!.identification.devedor).toBe("SP");
    expect(detail!.documentation.count).toBe(0);
    expect(detail!.contact.status).toBe("PROFESSIONAL_ROUTE");
  });

  it("prevents 2/2 inflation through duplicate evidence", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Dup Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const { task } = await generateManualResearchTask({
      organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", source: "TJSP_ESAJ",
      sourceId: "src-1", route: "cpopg", blockerType: "CAPTCHA_REQUIRED",
      sourceResult: "CAPTCHA_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], actorUserId: "test"
    }, db);

    // Submit doc 1
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/1", documentIdentifier: "DOC-1",
      documentReference: "CERT-1", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "Test Doc 1",
      qualificationStatus: "VERIFIED", evidenceStrength: "STRONG",
      documentType: "OFICIO_REQUISITORIO"
    }, db);

    const docs1 = await listOfficialEvidence(op.id, ORG, db);
    expect(countVerifiedOfficialEvidence(docs1)).toBe(1);

    // Submit same doc (same URL and ID) — should be deduplicated by idempotency key
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/1", documentIdentifier: "DOC-1",
      documentReference: "CERT-1", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "Test Doc 1 DUPLICATE",
      qualificationStatus: "VERIFIED", evidenceStrength: "STRONG",
      documentType: "OFICIO_REQUISITORIO"
    }, db);

    const docs2 = await listOfficialEvidence(op.id, ORG, db);
    // Should still be 1 — duplicate URL/ID must not inflate
    expect(countVerifiedOfficialEvidence(docs2)).toBe(1);
  });

  it("demonstrates 0/2 → 1/2 → 2/2 deterministically", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "2/2 Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const { task } = await generateManualResearchTask({
      organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", source: "TJSP_ESAJ",
      sourceId: "src-1", route: "cpopg", blockerType: "CAPTCHA_REQUIRED",
      sourceResult: "CAPTCHA_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], actorUserId: "test"
    }, db);

    // State: 0/2
    const docs0 = await listOfficialEvidence(op.id, ORG, db);
    expect(countVerifiedOfficialEvidence(docs0)).toBe(0);

    // Submit doc 1 → 1/2
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/doc-a", documentIdentifier: "ID-A",
      documentReference: "REF-A", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "Doc A",
      qualificationStatus: "VERIFIED", evidenceStrength: "STRONG",
      documentType: "OFICIO_REQUISITORIO"
    }, db);
    const docs1 = await listOfficialEvidence(op.id, ORG, db);
    expect(countVerifiedOfficialEvidence(docs1)).toBe(1);

    // Submit doc 2 (DISTINCT) → 2/2
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/doc-b", documentIdentifier: "ID-B",
      documentReference: "REF-B", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "Doc B",
      qualificationStatus: "VERIFIED", evidenceStrength: "STRONG",
      documentType: "OFICIO_REQUISITORIO"
    }, db);
    const docs2 = await listOfficialEvidence(op.id, ORG, db);
    expect(countVerifiedOfficialEvidence(docs2)).toBe(2);
  });

  it("weak/unverified evidence does not count toward 2/2", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Weak Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const { task } = await generateManualResearchTask({
      organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", source: "TJSP_ESAJ",
      sourceId: "src-1", route: "cpopg", blockerType: "CAPTCHA_REQUIRED",
      sourceResult: "CAPTCHA_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], actorUserId: "test"
    }, db);

    // Submit WEAK evidence
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/weak-1", documentIdentifier: "WEAK-1",
      documentReference: "WEAK-REF", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "Weak doc",
      qualificationStatus: "COLLECTED", evidenceStrength: "WEAK",
      documentType: "OFICIO_REQUISITORIO"
    }, db);
    
    const docs = await listOfficialEvidence(op.id, ORG, db);
    expect(countVerifiedOfficialEvidence(docs)).toBe(0);
  });

  it("task remains IN_PROGRESS when blocker is not fully resolved", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Lifecycle Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const { task } = await generateManualResearchTask({
      organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", source: "TJSP_ESAJ",
      sourceId: "src-1", route: "cpopg", blockerType: "CAPTCHA_REQUIRED",
      sourceResult: "CAPTCHA_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], actorUserId: "test"
    }, db);

    // Submit only 1 of 2 required docs
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/lc-1", documentIdentifier: "LC-1",
      documentReference: "REF-LC", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "LC Doc 1",
      qualificationStatus: "VERIFIED", evidenceStrength: "STRONG",
      documentType: "OFICIO_REQUISITORIO"
    }, db);

    // Task should remain IN_PROGRESS (1/2 is not enough)
    const taskResult = await db.execute({
      sql: "SELECT status FROM manual_research_tasks WHERE id=?",
      args: [task.id]
    });
    expect(taskResult.rows[0]?.status).toBe("IN_PROGRESS");
  });

  it("tenant isolation: getCaseDetail returns null for wrong tenant", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Tenant Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const detail = await getCaseDetail(op.id, "other-org", db);
    expect(detail).toBeNull();
  });

  it("rejected evidence does not trigger false qualification", async () => {
    const wf = makeWorkflow();
    const op = await createOperation({
      title: "Reject Test", debtor: "SP", tribunal: "TJSP",
      process: "2222222-22.2222.2.22.2222", owner: "tester", source: "E2E", workflow: wf
    }, db, ORG);

    const { task } = await generateManualResearchTask({
      organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", source: "TJSP_ESAJ",
      sourceId: "src-1", route: "cpopg", blockerType: "CAPTCHA_REQUIRED",
      sourceResult: "CAPTCHA_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"], actorUserId: "test"
    }, db);

    // Submit FAILED evidence
    await submitManualEvidence({
      taskId: task.id, organizationId: ORG, operationId: op.id,
      depre: "1111111-11.1111.1.11.1111", actorUserId: "test",
      officialUrl: "https://esaj.tjsp.jus.br/fail-1", documentIdentifier: "FAIL-1",
      documentReference: "FAIL-REF", documentDate: new Date().toISOString(),
      source: "TJSP_ESAJ", evidenceNotes: "Failed doc",
      qualificationStatus: "FAILED", evidenceStrength: "WEAK",
      documentType: "OFICIO_REQUISITORIO"
    }, db);

    const docs = await listOfficialEvidence(op.id, ORG, db);
    expect(countVerifiedOfficialEvidence(docs)).toBe(0);
  });
});
