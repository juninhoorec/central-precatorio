import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { applyOperationsSchema, createOperation, getOperation } from "./operations";
import { createDefaultWorkflow } from "./operational-workflow";
import { applySchemaMigrations } from "./schema-migrations";
import { initializeAudit, listAudit } from "./audit";
import { initializeAutonomousAcquisition, recordOfficialEvidence, getAutonomousDashboard } from "./autonomous-acquisition";
import { initializeDocumentStorage, DatabaseStorageAdapter } from "./document-storage";
import { generateManualResearchTask, listManualResearchTasks, updateManualTaskStatus } from "./manual-research";
import { beginAiReconfirmation, getAiReconfirmationAttempt } from "./ai-reconfirmation";
import { beginImport, initializeCaptureImports, recordImportSourceRow } from "./capture-imports";
import { enqueueImportedBatch } from "./autonomous-acquisition";
import { createCrmRecord, getCrmRecord } from "./crm-service";

const tenantA = "tenant-security-a";
const tenantB = "tenant-security-b";
const userA = "user-security-a";

async function createTenantOperation(db: ReturnType<typeof createClient>) {
  const workflow = createDefaultWorkflow(150_000);
  workflow.credit.numeroProcessoDEPRE = "0032722-57.2014.8.26.0500";
  workflow.client.name = "Tenant A draft beneficiary";
  return createOperation({
    title: "Tenant A operation",
    debtor: "Estado de São Paulo",
    tribunal: "TJSP",
    process: "0008831-10.2002.8.26.0053",
    owner: "",
    source: "Test fixture",
    stage: "Entrada",
    nominal: 150_000,
    notes: "Tenant isolation fixture",
    tasks: [],
    checks: [],
    proposals: [],
    workflow,
    isDemo: false,
  }, db, tenantA, userA);
}

describe("cross-tenant isolation E2E", () => {
  it("keeps operation, document, evidence, task, job, AI attempt, CRM and audit inside tenant A", async () => {
    const db = createClient({ url: ":memory:" });
    await applyOperationsSchema(db);
    await applySchemaMigrations(db);
    await initializeAudit(db);
    await initializeAutonomousAcquisition(db);
    await initializeDocumentStorage(db);
    await initializeCaptureImports(db);

    const operation = await createTenantOperation(db);
    const storage = new DatabaseStorageAdapter(db);
    const document = await storage.upload({
      operationId: operation.id,
      organizationId: tenantA,
      name: "official-record.pdf",
      bytes: new TextEncoder().encode("%PDF-1.4 tenant A content"),
      createdBy: userA,
    });
    await recordOfficialEvidence({
      operationId: operation.id,
      organizationId: tenantA,
      documentType: "OFICIO_REQUISITORIO",
      title: "Synthetic official record",
      source: "TJSP",
      sourceUrl: "https://www.tjsp.jus.br/Precatorios/consulta",
      downloadUrl: "",
      documentIdentifier: "DOC-A-001",
      reference: "DEPRE-TEST-A",
      publishedAt: "2026-10-01",
      page: 1,
      hash: "",
      contentFingerprint: "fingerprint-a",
      status: "VERIFIED",
      evidenceStrength: "STRONG",
      notes: "Synthetic isolation fixture",
      idempotencyKey: "tenant-a-evidence-key-001",
    }, db);
    const { task } = await generateManualResearchTask({
      organizationId: tenantA,
      operationId: operation.id,
      depre: operation.workflow.credit.numeroProcessoDEPRE,
      source: "TJSP",
      sourceId: "tjsp-esaj",
      route: "manual-review",
      blockerType: "MANUAL_REQUIRED",
      sourceResult: "MANUAL_REQUIRED",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2"],
      actorUserId: userA,
    }, db);

    const batch = await beginImport({
      organizationId: tenantA,
      userId: userA,
      sourceId: "tjsp-cac-assisted",
      sourceName: "TJSP/CAC assisted",
      fileName: "tenant-a.csv",
      sourceReference: "https://www.tjsp.jus.br/cac/",
      bytes: new TextEncoder().encode("tenant-a-import-fixture"),
    }, db);
    await recordImportSourceRow({
      organizationId: tenantA,
      batchId: batch.batch.id,
      operationId: operation.id,
      rowNumber: 1,
      sourceReference: "https://www.tjsp.jus.br/cac/",
      rawValues: { row: 1 },
      normalizedValues: { tenant: tenantA },
    }, db);
    await enqueueImportedBatch(batch.batch.id, tenantA, userA, db);

    const aiAttempt = await beginAiReconfirmation({
      organizationId: tenantA,
      operationId: operation.id,
      actorUserId: userA,
      model: "fixture-model",
      promptVersion: "v1",
      client: db,
      storage,
    });
    const crm = await createCrmRecord({
      id: crypto.randomUUID(),
      organizationId: tenantA,
      operationId: operation.id,
      opportunityId: null,
      contactIds: [],
      stage: "NEW",
      nextActionAt: null,
    }, db);

    expect(await getOperation(operation.id, db, tenantB)).toBeNull();
    expect(await storage.getMetadata(document.id, tenantB)).toBeNull();
    expect(await storage.createPrivateAccess(document.id, tenantB)).toBeNull();
    expect(await listManualResearchTasks(tenantB, {}, db)).toEqual([]);
    await expect(updateManualTaskStatus(task.id, tenantB, "IN_PROGRESS", "attacker", undefined, db))
      .rejects.toThrow("MANUAL_TASK_NOT_FOUND_OR_WRONG_TENANT");
    expect((await getAutonomousDashboard(tenantB, {}, db)).metrics.total).toBe(0);
    expect(await getAiReconfirmationAttempt(aiAttempt!.id, tenantB, operation.id, db)).toBeNull();
    expect(await getCrmRecord(crm.id, tenantB, db)).toBeNull();
    expect(await listAudit(tenantB, undefined, undefined, db)).toEqual([]);
    expect((await listAudit(tenantA, undefined, undefined, db)).length).toBeGreaterThan(0);

    await db.close();
  });
});
