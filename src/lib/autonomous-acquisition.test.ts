import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultWorkflow } from "./operational-workflow";
import { beginImport, initializeCaptureImports, recordImportSourceRow } from "./capture-imports";
import { createOperation, getOperation } from "./operations";
import { countVerifiedOfficialEvidence, enqueueImportedBatch, getAcquisitionProfile, getAutonomousDashboard, initializeAutonomousAcquisition, listAcquisitionContacts, processAcquisitionCycle, recordOfficialEvidence, recordAcquisitionContact } from "./autonomous-acquisition";

afterEach(() => vi.unstubAllEnvs());

async function makeOperation(db: ReturnType<typeof createClient>, input: { organizationId: string; amount: number; creditor?: string; originProcess?: string; debtorState?: string }) {
  const workflow = createDefaultWorkflow(input.amount);
  workflow.client.name = input.creditor || "";
  workflow.credit.numeroProcessoDEPRE = "7006050-78.2000.8.26.0500";
  workflow.credit.numeroProcessoDEPRENormalizado = "70060507820008260500";
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

    vi.stubEnv("DATAJUD_PUBLIC_API_KEY", "test-only-datajud-key");
    vi.stubEnv("DATAJUD_COMMERCIAL_USE_AUTHORIZED", "true");
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/v1/comunicacao")) {
        return Response.json({ status: "success", count: 0, items: [] });
      }
      return Response.json({ hits: { hits: [] } });
    });
    const cycle = await processAcquisitionCycle({ organizationId: org, actorUserId: "test-actor", limit: 2, client: db, fetcher });
    expect(cycle.processed).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const dashboard = await getAutonomousDashboard(org, {}, db);
    expect(dashboard.metrics.total).toBe(2);
    expect(dashboard.metrics.rejected).toBe(1);
    expect(dashboard.metrics.waitingSource).toBe(1);
    const sourceEvents = await db.execute({
      sql: "SELECT source_id,status,access_result FROM acquisition_events WHERE organization_id=? ORDER BY consulted_at",
      args: [org],
    });
    expect(sourceEvents.rows.some((event) => event.source_id === "datajud")).toBe(true);
    expect(sourceEvents.rows).toContainEqual(
      expect.objectContaining({
        source_id: "djen",
        status: "NO_RESULT",
        access_result: "NO_RESULT",
      }),
    );
    expect(sourceEvents.rows).toContainEqual(
      expect.objectContaining({
        source_id: "tjsp-esaj",
        status: "MANUAL_REQUIRED",
        access_result: "NO_REQUEST_MADE",
      }),
    );
    expect((await getAutonomousDashboard("acquisition-org-b", {}, db)).metrics.total).toBe(0);
    await db.close();
  });

  it("does not consume request budget or call DataJud for an invalid DEPRE", async () => {
    const db = createClient({ url: ":memory:" });
    const org = "acquisition-invalid-id-org";
    const operation = await makeOperation(db, {
      organizationId: org,
      amount: 150000,
    });
    const workflow = operation.workflow;
    workflow.credit.numeroProcessoDEPRE = "7006050-79.2000.8.26.0500";
    workflow.credit.numeroProcessoDEPRENormalizado = "70060507920008260500";
    await db.execute({
      sql: "UPDATE operations SET workflow=? WHERE id=? AND organization_id=?",
      args: [JSON.stringify(workflow), operation.id, org],
    });
    const batchId = await makeBatch(db, org, [operation.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);
    const fetcher = vi.fn(async () =>
      Response.json({ status: "success", count: 0, items: [] }),
    );

    await processAcquisitionCycle({
      organizationId: org,
      actorUserId: "test-actor",
      limit: 1,
      client: db,
      fetcher,
    });

    expect(fetcher).not.toHaveBeenCalled();
    const event = await db.execute({
      sql: "SELECT status,details_json FROM acquisition_events WHERE organization_id=? AND source_id='datajud'",
      args: [org],
    });
    expect(event.rows).toHaveLength(1);
    expect(event.rows[0].status).toBe("INVALID_IDENTIFIER");
    expect(JSON.parse(String(event.rows[0].details_json))).toMatchObject({
      requestAttempted: false,
      responseClass: "INVALID_IDENTIFIER",
    });
    await db.close();
  });

  it("keeps key-missing source failure distinct from creditor not found", async () => {
    const db = createClient({ url: ":memory:" });
    const org = "acquisition-no-key-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 150000 });
    const batchId = await makeBatch(db, org, [operation.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);
    vi.stubEnv("DATAJUD_PUBLIC_API_KEY", "");
    vi.stubEnv("DATAJUD_COMMERCIAL_USE_AUTHORIZED", "true");
    const fetcher = vi.fn(async () =>
      Response.json({ status: "success", count: 0, items: [] }),
    );

    await processAcquisitionCycle({
      organizationId: org,
      actorUserId: "test-actor",
      limit: 1,
      client: db,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const dashboard = await getAutonomousDashboard(org, {}, db);
    expect(dashboard.jobs[0].status).toBe("SOURCE_BLOCKED");
    expect(dashboard.jobs[0].reasons).toContain("DATAJUD_KEY_NOT_CONFIGURED");
    expect(dashboard.jobs[0].reasons).not.toContain("CREDITOR_NOT_IDENTIFIED");
    expect(dashboard.jobs[0].summary.creditor).toBe(
      "Investigação: DATAJUD_KEY_NOT_CONFIGURED",
    );
    const djen = await db.execute({
      sql: "SELECT status,details_json FROM acquisition_events WHERE organization_id=? AND source_id='djen'",
      args: [org],
    });
    expect(djen.rows).toHaveLength(2);
    const noResult = djen.rows.find((row) => row.status === "NO_RESULT");
    const invalidQuery = djen.rows.find((row) => row.status === "INVALID_QUERY");
    expect(noResult).toBeDefined();
    expect(JSON.parse(String(noResult?.details_json))).toMatchObject({
      requestAttempted: true,
      responseClass: "NO_RESULT",
      resultCount: 0,
    });
    expect(invalidQuery).toBeDefined();
    expect(JSON.parse(String(invalidQuery?.details_json))).toMatchObject({
      requestAttempted: false,
      responseClass: "INVALID_QUERY",
    });
    await db.close();
  });

  it("persists DJEN party/contact provenance without turning a communication into verified official evidence", async () => {
    const db = createClient({ url: ":memory:" });
    const org = "acquisition-djen-found-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 150000 });
    const batchId = await makeBatch(db, org, [operation.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);
    vi.stubEnv("DATAJUD_PUBLIC_API_KEY", "");
    vi.stubEnv("DATAJUD_COMMERCIAL_USE_AUTHORIZED", "false");
    const fetcher = vi.fn(async () =>
      Response.json({
        status: "success",
        count: 1,
        items: [{
          id: 1,
          hash: "synthetic-djen-hash",
          numero_processo: "70060507820008260500",
          siglaTribunal: "TJSP",
          tipoComunicacao: "Intimação",
          data_disponibilizacao: "2026-04-01",
          texto: "CREDOR: Pessoa Sintética; contato piloto@example.invalid",
          destinatarios: [{ nome: "Pessoa Sintética", polo: "A" }],
        }],
      }),
    );

    await processAcquisitionCycle({
      organizationId: org,
      actorUserId: "test-actor",
      limit: 1,
      client: db,
      fetcher,
    });

    const event = await db.execute({
      sql: "SELECT status,details_json FROM acquisition_events WHERE organization_id=? AND source_id='djen'",
      args: [org],
    });
    expect(event.rows[0].status).toBe("FOUND");
    expect(JSON.parse(String(event.rows[0].details_json))).toMatchObject({
      requestAttempted: true,
      communicationCount: 1,
      partyCandidates: expect.arrayContaining([
        expect.objectContaining({
          name: "Pessoa Sintética",
          role: "CREDOR",
          source: "djen",
        }),
      ]),
    });
    expect(await listAcquisitionContacts(operation.id, org, db)).toEqual([
      expect.objectContaining({
        type: "EMAIL",
        value: "piloto@example.invalid",
        source: "DJEN",
        notes: "Contato localizado em comunicação pública; não verificado.",
      }),
    ]);
    expect(
      Number((await db.execute({
        sql: "SELECT COUNT(*) AS count FROM official_evidence_documents WHERE operation_id=?",
        args: [operation.id],
      })).rows[0]?.count),
    ).toBe(0);
    await db.close();
  });

  it("reuses a fresh successful DJEN response instead of repeating the same query", async () => {
    const db = createClient({ url: ":memory:" });
    const org = "acquisition-djen-cache-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 150000 });
    const batchId = await makeBatch(db, org, [operation.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);
    vi.stubEnv("DATAJUD_PUBLIC_API_KEY", "");
    const fetcher = vi.fn(async () =>
      Response.json({ status: "success", count: 0, items: [] }),
    );

    await processAcquisitionCycle({
      organizationId: org,
      actorUserId: "test-actor",
      limit: 1,
      client: db,
      fetcher,
    });
    await db.execute({
      sql: "UPDATE autonomous_acquisition_jobs SET status='WAITING',next_run_at='2000-01-01T00:00:00.000Z' WHERE operation_id=?",
      args: [operation.id],
    });
    await processAcquisitionCycle({
      organizationId: org,
      actorUserId: "test-actor",
      limit: 1,
      client: db,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const events = await db.execute({
      sql: "SELECT event_type,status,details_json FROM acquisition_events WHERE organization_id=? AND source_id='djen' ORDER BY consulted_at",
      args: [org],
    });
    const cacheEvent = events.rows.find((row) => row.event_type === "CACHE_HIT");
    expect(cacheEvent).toMatchObject({
      event_type: "CACHE_HIT",
      status: "NO_RESULT",
    });
    expect(JSON.parse(String(cacheEvent?.details_json))).toMatchObject({
      cached: true,
      requestAttempted: false,
      responseClass: "NO_RESULT",
    });
    expect(events.rows.filter((row) =>
      JSON.parse(String(row.details_json)).requestAttempted === true,
    )).toHaveLength(1);
    await db.close();
  });

  it("applies the DJEN cooldown globally after a 429 response", async () => {
    const db = createClient({ url: ":memory:" });
    const org = "acquisition-djen-cooldown-org";
    const first = await makeOperation(db, { organizationId: org, amount: 150000 });
    const second = await makeOperation(db, { organizationId: org, amount: 150000 });
    const secondWorkflow = second.workflow;
    secondWorkflow.credit.numeroProcessoDEPRE = "0003214-57.1973.8.26.0224";
    await db.execute({
      sql: "UPDATE operations SET workflow=? WHERE id=? AND organization_id=?",
      args: [JSON.stringify(secondWorkflow), second.id, org],
    });
    const batchId = await makeBatch(db, org, [first.id, second.id]);
    await enqueueImportedBatch(batchId, org, "test-actor", db);
    vi.stubEnv("DATAJUD_PUBLIC_API_KEY", "");
    const fetcher = vi.fn(async () => new Response(null, { status: 429 }));

    await processAcquisitionCycle({
      organizationId: org,
      actorUserId: "test-actor",
      limit: 2,
      client: db,
      fetcher,
    });

    expect(fetcher).toHaveBeenCalledTimes(1);
    const rateLimited = await db.execute({
      sql: "SELECT status,details_json FROM acquisition_events WHERE organization_id=? AND source_id='djen'",
      args: [org],
    });
    expect(rateLimited.rows).toHaveLength(2);
    expect(rateLimited.rows.every((row) => row.status === "RATE_LIMITED")).toBe(true);
    expect(rateLimited.rows.filter((row) =>
      JSON.parse(String(row.details_json)).requestAttempted === true,
    )).toHaveLength(1);
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
    await recordOfficialEvidence({ ...evidenceBase, documentType: "OFICIO_COMPLEMENTAR", documentIdentifier: "DOC-SINTETICO-002", reference: "DEMO-OFFICIAL-002", contentFingerprint: "fixture-2", idempotencyKey: "official-doc-fixture-2", organizationId: org }, db);

    const cycle = await processAcquisitionCycle({ organizationId: org, actorUserId: "test-actor", limit: 1, client: db, fetcher: vi.fn() });
    expect(cycle.counts.READY_FOR_ANALYST).toBe(1);
    const dashboard = await getAutonomousDashboard(org, {}, db);
    expect(dashboard.metrics.ready).toBe(1);
    expect(dashboard.jobs[0].summary).toMatchObject({
      title: "OPPORTUNITY SUMMARY",
      creditor: "Credor sintético resolvido",
      depre: "7006050-78.2000.8.26.0500",
      officialEvidence: "2/2",
      status: "READY_FOR_ANALYST",
    });
    expect((await db.execute({ sql: "SELECT COUNT(*) AS count FROM acquisition_contacts WHERE organization_id=?", args: [org] })).rows[0].count).toBe(0);
    const deliveries = await db.execute({ sql: "SELECT channel,status,summary_json FROM notification_deliveries WHERE organization_id=?", args: [org] });
    expect(deliveries.rows).toHaveLength(0);
    await db.close();
  });

  it("round-trips provider/source/route provenance while counting one document across routes", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAutonomousAcquisition(db);
    const org = "acquisition-provenance-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 180000, creditor: "Credor sintético" });
    const before = await getOperation(operation.id, db, org);
    const sharedDocumentHash = "a".repeat(64);
    const common = {
      operationId: operation.id,
      organizationId: org,
      documentType: "OFICIO_REQUISITORIO" as const,
      title: "Ofício oficial sintético",
      source: "TJSP/DEPRE · publicador oficial",
      downloadUrl: "",
      documentIdentifier: "DOC-DEPRE-001",
      reference: "DEPRE-REF-001",
      publishedAt: "2026-09-01",
      page: 1,
      hash: sharedDocumentHash,
      contentFingerprint: "fingerprint-shared-doc",
      status: "VERIFIED" as const,
      evidenceStrength: "STRONG" as const,
      notes: "Documento sintético para teste isolado.",
    };

    const cpopgRecord = await recordOfficialEvidence({
      ...common,
      sourceUrl: "https://www.tjsp.jus.br/Precatorios/documento-1",
      sourceProvenance: { provider: "JUSCRAPER", sourceId: "tjsp-processual", route: "cpopg" },
      idempotencyKey: "provenance-cpopg-doc-001",
    }, db);
    const cposgRecord = await recordOfficialEvidence({
      ...common,
      sourceUrl: "https://esaj.tjsp.jus.br/documento-espelho-1",
      sourceProvenance: { provider: "JUSCRAPER", sourceId: "tjsp-processual", route: "cposg" },
      idempotencyKey: "provenance-cposg-doc-001",
    }, db);

    expect(cpopgRecord.sourceProvenance).toEqual({ provider: "JUSCRAPER", sourceId: "tjsp-processual", route: "cpopg" });
    expect(cposgRecord.sourceProvenance).toEqual({ provider: "JUSCRAPER", sourceId: "tjsp-processual", route: "cposg" });
    expect(countVerifiedOfficialEvidence([cpopgRecord, cposgRecord])).toBe(1);
    const after = await getOperation(operation.id, db, org);
    expect(after?.version).toBe(before?.version);
    expect(after?.workflow.inventory.availability).toBe(before?.workflow.inventory.availability);
    expect(await db.execute("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='table' AND name='ai_reconfirmation_runs'")).toMatchObject({ rows: [{ count: 0 }] });
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
    expect(cycle.counts.SOURCE_BLOCKED).toBe(1);
    expect((await getAutonomousDashboard(org, {}, db)).jobs[0].reasons).toContain(
      "DATAJUD_USE_NOT_AUTHORIZED",
    );
    expect((await getAutonomousDashboard(org, {}, db)).metrics.ready).toBe(0);
    expect((await db.execute({ sql: "SELECT COUNT(*) AS count FROM notification_deliveries WHERE organization_id=?", args: [org] })).rows[0].count).toBe(0);
    await db.close();
  });

  it("enforces official URL requirement and rejects non-official source URLs", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAutonomousAcquisition(db);
    const org = "acquisition-url-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 120000, creditor: "Credor URL test" });

    await expect(recordOfficialEvidence({
      operationId: operation.id,
      organizationId: org,
      documentType: "OFICIO_REQUISITORIO",
      title: "Doc não oficial",
      source: "Terceiro",
      sourceUrl: "https://site-falso.com/doc",
      downloadUrl: "",
      status: "VERIFIED",
      evidenceStrength: "STRONG",
      idempotencyKey: "invalid-url-1",
    }, db)).rejects.toThrow("OFFICIAL_SOURCE_URL_REQUIRED");

    await db.close();
  });

  it("records contacts with official source URL and preserves contact localized note", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAutonomousAcquisition(db);
    const org = "acquisition-contact-org";
    const operation = await makeOperation(db, { organizationId: org, amount: 200000, creditor: "Credor contato test" });

    const contact = await recordAcquisitionContact({
      operationId: operation.id,
      organizationId: org,
      type: "PHONE",
      value: "(11) 98765-4321",
      source: "TJSP / Consulta Pública",
      sourceUrl: "https://www.tjsp.jus.br/Precatorios/consulta",
      confidence: 85,
      notes: "Contato localizado público",
      idempotencyKey: "contact-1",
    }, db);

    expect(contact.value).toBe("(11) 98765-4321");
    expect(contact.sourceUrl).toBe("https://www.tjsp.jus.br/Precatorios/consulta");
    expect(contact.confidence).toBe(85);

    await db.close();
  });

  it("counts only two distinct verified requisition notices, not duplicate rows or general search records", async () => {
    const base = {
      id: "evidence-1",
      organizationId: "org",
      operationId: "operation",
      documentType: "OFICIO_REQUISITORIO" as const,
      title: "Ofício de teste",
      source: "TJSP",
      sourceUrl: "https://www.tjsp.jus.br/consulta",
      downloadUrl: "",
      documentIdentifier: "DOC-001",
      reference: "",
      publishedAt: "2026-09-01",
      collectedAt: "2026-09-01T12:00:00.000Z",
      page: null,
      hash: "",
      contentFingerprint: "",
      status: "VERIFIED" as const,
      evidenceStrength: "STRONG" as const,
      notes: "",
      sourceProvenance: null,
    };
    expect(
      countVerifiedOfficialEvidence([
        base,
        {
          ...base,
          id: "evidence-duplicate",
          documentType: "OFICIO_COMPLEMENTAR",
          sourceUrl: "https://esaj.tjsp.jus.br/consulta",
        },
      ]),
    ).toBe(1);
    expect(
      countVerifiedOfficialEvidence([
        { ...base, documentIdentifier: "", reference: "" },
      ]),
    ).toBe(0);
    expect(
      countVerifiedOfficialEvidence([
        base,
        {
          ...base,
          id: "evidence-2",
          documentType: "OFICIO_COMPLEMENTAR",
          documentIdentifier: "DOC-002",
        },
      ]),
    ).toBe(2);
    expect(
      countVerifiedOfficialEvidence([
        base,
        {
          ...base,
          id: "general-record",
          documentType: "OFFICIAL_RECORD",
          documentIdentifier: "DATAJUD-001",
        },
      ]),
    ).toBe(1);
  });

  it("does not attach official evidence to an operation in another organization", async () => {
    const db = createClient({ url: ":memory:" });
    await initializeAutonomousAcquisition(db);
    const operation = await makeOperation(db, {
      organizationId: "evidence-owner",
      amount: 180000,
      creditor: "Credor sintético",
    });

    await expect(
      recordOfficialEvidence(
        {
          operationId: operation.id,
          organizationId: "different-organization",
          documentType: "OFICIO_REQUISITORIO",
          title: "Ofício de teste",
          source: "TJSP",
          sourceUrl: "https://www.tjsp.jus.br/consulta",
          downloadUrl: "",
          documentIdentifier: "DOC-OWNER",
          reference: "",
          publishedAt: "2026-09-01",
          status: "VERIFIED",
          evidenceStrength: "STRONG",
          idempotencyKey: "cross-tenant-evidence-1",
        },
        db,
      ),
    ).rejects.toThrow("EVIDENCE_OPERATION_TENANT_MISMATCH");
    await db.close();
  });

  it("enforces at least two official offices even if a stored profile is configured lower", async () => {
    const db = createClient({ url: ":memory:" });
    await db.execute(
      "CREATE TABLE acquisition_profiles (organization_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL)",
    );
    await db.execute({
      sql: "INSERT INTO acquisition_profiles (organization_id, profile_json) VALUES (?, ?)",
      args: [
        "minimum-evidence-org",
        JSON.stringify({
          minimumPrecatory: 200000,
          minimumOfficialEvidence: 1,
          state: "SP",
          tribunal: "TJSP",
        }),
      ],
    });

    const profile = await getAcquisitionProfile("minimum-evidence-org", db);
    expect(profile.minimumPrecatory).toBe(200000);
    expect(profile.minimumOfficialEvidence).toBe(2);
    await db.close();
  });
});