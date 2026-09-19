import { createClient } from "@libsql/client";
import { describe, expect, it, vi } from "vitest";
import { createDefaultWorkflow } from "./operational-workflow";
import { beginImport, initializeCaptureImports, recordImportSourceRow } from "./capture-imports";
import { createOperation } from "./operations";
import { enqueueImportedBatch, getAutonomousDashboard, initializeAutonomousAcquisition, processAcquisitionCycle, recordOfficialEvidence } from "./autonomous-acquisition";

async function makeOperation(db: ReturnType<typeof createClient>, input: { organizationId: string; amount: number; creditor?: string; originProcess?: string; debtorState?: string }) {
  const workflow = createDefaultWorkflow(input.amount);
  workflow.client.name = input.creditor || "";
  workflow.credit.numeroProcessoDEPRE = "DEMO-DEPRE-AUTO-001";
  workflow.credit.numeroProcessoDEPRENormalizado = "DEMODEPREAUTO001";
  workflow.credit.originProcessNumber = input.originProcess || "DEMO-PROC-AUTO-001";
  workflow.credit.debtorState = input.debtorState || "SP";
  workflow.credit.checkedAt = new Date().toISOString();
  return createOperation({
    title: "Aquisição automática sintética",
    debtor: "Município sintético de SP",
    tribunal: "TJSP",
    process: workflow.credit.originProcessNumber,
    owner: "",
    source: "TJSP/CAC · lote de teste",
    stage: "Entrada",
    nominal: input.amount,
    notes: "Fixture sintético para teste do worker.",
    tasks: [], checks: [], proposals: [], workflow, isDemo: false,
  }, db, input.organizationId, "test-actor");
}

async function makeBatch(db: ReturnType<typeof createClient>, organizationId: string, operationIds: string[]) {
  await initializeCaptureImports(db);
  const batch = await beginImport({
    organizationId,
    userId: "test-actor",
    sourceId: "tjsp-cac-assisted",
    sourceName: "TJSP/CAC · Captura assistida",
    fileName: "ListaPrecatorioPendente_TESTE.pdf",
    sourceReference: "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx",
    bytes: new TextEncoder().encode("synthetic import batch"),
  }, db);
  for (const [index, operationId] of operationIds.entries()) {
    await recordImportSourceRow({
      organizationId,
      batchId: batch.batch.id,
      operationId,
      rowNumber: index + 1,
      sourceReference: "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx",
      rawValues: { row: index + 1 },
      normalizedValues: { source: "synthetic" },
    }, db);
  }
  return batch.batch.id;
}

describe("autonomous acquisition queue", () => {
  it("enqueues imported cases once, cheap-rejects below-minimum work, and isolates organizations", async () => {
    const db = createClient({ url: ":memory:" });
    const org = "acquisition-org-a";
    const low = await makeOperation(db, { organizationId: org, amount: 99000, creditor: "Credor sintético" });
    const valid = await makeOperation(db, { organizationId: org, amount: 150000, originProcess: "12345678901234567890" });
    const batchId = await makeBatch(db, org, [low.id, valid.id]);
    expect((await enqueueImportedBatch(batchId, org, "test-actor", db)).enqueued).toBe(2);
    expect((await enqueueImportedBatch(batchId, org, "test-actor", db)).enqueued).toBe(0);

    const fetcher = vi.fn(async () => new Response(JSON.stringify({ hits: { hits: [] } }), { status: 200, headers: { "content-type": "application/json" } }));
    const cycle = await processAcquisitionCycle({ organizationId: org, actorUserId: "test-actor", limit: 2, client: db, fetcher });
    expect(cycle.processed).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const dashboard = await getAutonomousDashboard(org, {}, db);
    expect(dashboard.metrics.total).toBe(2);
    expect(dashboard.metrics.rejected).toBe(1);
    expect(dashboard.metrics.waitingSource).toBe(1);
    expect((await getAutonomousDashboard("acquisition-org-b", {}, db)).metrics.total).toBe(0);
    await db.close();
  });

  it("requires two individually verified official documents for READY, while contact remains optional", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAutonomousAcquisition(db);
    const org = "acquisition-ready-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 180000, creditor: "Credor sintético resolvido" });
    const batchId = await makeBatch(db, org, [operation.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);

    const evidenceBase = {
      operationId: operation.id,
      title: "Ofício sintético de teste",
      source: "TJSP · fixture sintética",
      sourceUrl: "https://www.tjsp.jus.br/Precatorios/consulta-sintetica",
      downloadUrl: "",
      documentIdentifier: "DOC-SINTETICO",
      reference: "DEMO-OFFICIAL-001",
      publishedAt: "2026-09-01",
      page: 1,
      hash: "",
      contentFingerprint: "fixture-1",
      status: "VERIFIED" as const,
      evidenceStrength: "STRONG" as const,
      notes: "Documento oficial sintético usado apenas em teste.",
    };
    await recordOfficialEvidence({ ...evidenceBase, documentType: "OFICIO_REQUISITORIO", idempotencyKey: "official-doc-fixture-1", organizationId: org }, db);
    await recordOfficialEvidence({ ...evidenceBase, documentType: "OFICIO_COMPLEMENTAR", reference: "DEMO-OFFICIAL-002", contentFingerprint: "fixture-2", idempotencyKey: "official-doc-fixture-2", organizationId: org }, db);

    const cycle = await processAcquisitionCycle({ organizationId: org, actorUserId: "test-actor", limit: 1, client: db, fetcher: vi.fn() });
    expect(cycle.counts.READY_FOR_ANALYST).toBe(1);
    const dashboard = await getAutonomousDashboard(org, {}, db);
    expect(dashboard.metrics.ready).toBe(1);
    expect(dashboard.jobs[0].summary).toMatchObject({
      title: "OPPORTUNITY SUMMARY",
      creditor: "Credor sintético resolvido",
      depre: "DEMO-DEPRE-AUTO-001",
      officialEvidence: "2/2",
      status: "READY_FOR_ANALYST",
    });
    expect((await db.execute({ sql: "SELECT COUNT(*) AS count FROM acquisition_contacts WHERE organization_id=?", args: [org] })).rows[0].count).toBe(0);
    const deliveries = await db.execute({ sql: "SELECT channel,status,summary_json FROM notification_deliveries WHERE organization_id=?", args: [org] });
    expect(deliveries.rows).toHaveLength(1);
    expect(deliveries.rows[0]).toMatchObject({ channel: "TELEGRAM", status: "QUEUED" });
    await db.close();
  });

  it("keeps a case pending with only one official evidence document", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAutonomousAcquisition(db);
    const org = "acquisition-pending-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 180000, creditor: "Credor sintético" });
    const batchId = await makeBatch(db, org, [operation.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);
    await recordOfficialEvidence({
      operationId: operation.id, organizationId: org, documentType: "OFICIO_REQUISITORIO",
      title: "Ofício único sintético", source: "TJSP · fixture sintética",
      sourceUrl: "https://www.tjsp.jus.br/Precatorios/consulta-sintetica", downloadUrl: "",
      documentIdentifier: "DOC-SINTETICO-1", reference: "DEMO-OFFICIAL-ONLY-1", publishedAt: "2026-09-01", page: 1,
      hash: "", contentFingerprint: "fixture-only-1", status: "VERIFIED", evidenceStrength: "STRONG",
      notes: "Um de dois documentos sintéticos.", idempotencyKey: "official-doc-only-1",
    }, db);
    const cycle = await processAcquisitionCycle({ organizationId: org, actorUserId: "test-actor", limit: 1, client: db, fetcher: vi.fn() });
    expect(cycle.counts.QUALIFIED_WITH_PENDING).toBe(1);
    expect((await getAutonomousDashboard(org, {}, db)).metrics.ready).toBe(0);
    expect((await db.execute({ sql: "SELECT COUNT(*) AS count FROM notification_deliveries WHERE organization_id=?", args: [org] })).rows[0].count).toBe(0);
    await db.close();
  });
});