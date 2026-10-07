import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { initializeAutonomousAcquisition, recordOfficialEvidence, listOfficialEvidence } from "./autonomous-acquisition";
import { recordHistoricalBeneficiaryObservation, recordImportedBeneficiarySnapshot } from "./beneficiary-enrichment";
import { createDefaultWorkflow } from "./operational-workflow";
import { createOperation, getOperation } from "./operations";

async function fixture(clientName = "") {
  const client = createClient({ url: ":memory:" });
  const organizationId = "beneficiary-enrichment-org";
  const depre = "0038850-88.2017.8.26.0500";
  const workflow = createDefaultWorkflow();
  workflow.credit.numeroProcessoDEPRE = depre;
  workflow.client.name = clientName;
  const operation = await createOperation({
    title: `DEPRE ${depre}`, debtor: "Campinas", tribunal: "TJSP", process: "", owner: "",
    source: "TJSP/DEPRE · Pacote 73", stage: "Entrada", nominal: 0, notes: "",
    tasks: [], checks: [], proposals: [], workflow, isDemo: false,
  }, client, organizationId, "fixture");
  await initializeAutonomousAcquisition(client);
  const evidence = await recordOfficialEvidence({
    organizationId, operationId: operation.id, documentType: "OFFICIAL_RECORD",
    title: "Publicação municipal", source: "Diário Oficial de Campinas",
    sourceUrl: "https://portal-adm.campinas.sp.gov.br/documento.pdf", downloadUrl: "",
    documentIdentifier: "DOC-001", reference: "REF-001", publishedAt: "2021-10-14",
    page: 34, hash: "", contentFingerprint: "", status: "COLLECTED", evidenceStrength: "MEDIUM",
    notes: "Fixture oficial", sourceProvenance: { provider: "ASSISTED_OFFICIAL_WEB", sourceId: "campinas-diario-oficial", route: "official-pdf" },
    idempotencyKey: "beneficiary-fixture-evidence", 
  }, client);
  return { client, organizationId, operation, depre, evidence };
}

function observation(f: Awaited<ReturnType<typeof fixture>>, name: string, reference: string) {
  return {
    operationId: f.operation.id,
    organizationId: f.organizationId,
    actorUserId: "phase2-test",
    depre: f.depre,
    name,
    role: "TITULAR" as const,
    status: "HISTORICAL_CONFIRMED" as const,
    source: "Diário Oficial de Campinas",
    sourceUrl: "https://portal-adm.campinas.sp.gov.br/documento.pdf",
    sourceType: "OFFICIAL_PUBLICATION" as const,
    provider: "ASSISTED_OFFICIAL_WEB",
    sourceId: "campinas-diario-oficial",
    route: "official-pdf",
    sourceStatus: "SUCCESS" as const,
    documentIdentifier: reference,
    reference,
    collectedAt: "2026-10-04T00:00:00.000Z",
    evidenceId: f.evidence.id,
    evidenceStrength: "MEDIUM" as const,
    lawyerName: "",
    lawyerOab: "",
    lawyerSource: "",
    lawyerSourceUrl: "",
    lawyerSourceStatus: "" as const,
    context: "Relação histórica; não confirma titularidade atual.",
  };
}

describe("historical beneficiary enrichment", () => {
  it("keeps distinct beneficiaries on the exact DEPRE, reuses evidence, and is idempotent", async () => {
    const f = await fixture();
    const first = observation(f, "Lúcia Helena Silveira de Freitas Blandy", "PMC.2021.00051374-90");
    const second = observation(f, "Nelson Barthelson", "PMC.2021.00051365-07");
    expect((await recordHistoricalBeneficiaryObservation(first, f.client)).status).toBe("ADDED");
    expect((await recordHistoricalBeneficiaryObservation(second, f.client)).status).toBe("ADDED");
    expect((await recordHistoricalBeneficiaryObservation(first, f.client)).status).toBe("ALREADY_PRESENT");

    const saved = await getOperation(f.operation.id, f.client, f.organizationId);
    expect(saved?.workflow.client.name).toBe("");
    expect(saved?.workflow.client.beneficiaries.map((item) => item.name)).toEqual([
      "Lúcia Helena Silveira de Freitas Blandy",
      "Nelson Barthelson",
    ]);
    expect(saved?.workflow.client.beneficiaries.every((item) => item.depre === f.depre && item.evidenceId === f.evidence.id)).toBe(true);
    expect(await listOfficialEvidence(f.operation.id, f.organizationId, f.client)).toHaveLength(1);
    f.client.close();
  });

  it("rejects a beneficiary assertion linked to another DEPRE", async () => {
    const f = await fixture();
    await expect(recordHistoricalBeneficiaryObservation({
      ...observation(f, "Nome divergente", "REF-001"),
      depre: "0038851-73.2017.8.26.0500",
    }, f.client)).rejects.toThrow("BENEFICIARY_DEPRE_MISMATCH");
    const saved = await getOperation(f.operation.id, f.client, f.organizationId);
    expect(saved?.workflow.client.beneficiaries).toHaveLength(0);
    f.client.close();
  });

  it("preserves multiple imported names as unverified candidates without inventing official evidence", async () => {
    const f = await fixture("Maria Ester Rosa; Marta Diniz Rosa");
    const imported = (name: string) => ({
      operationId: f.operation.id,
      organizationId: f.organizationId,
      actorUserId: "phase2-test",
      depre: f.depre,
      name,
      role: "UNKNOWN" as const,
      status: "UNVERIFIED_IMPORT" as const,
      source: "CP_pacote_completo_73_DEPREs.xlsx",
      sourceUrl: "" as const,
      sourceType: "IMPORTED_SNAPSHOT" as const,
      provider: "CP_IMPORT",
      sourceId: "initial-depre-package-73",
      route: "xlsx-snapshot",
      sourceStatus: "NOT_ATTEMPTED" as const,
      documentIdentifier: "",
      reference: "Imported from original client.name snapshot; relation not verified",
      collectedAt: "2026-10-04T00:00:00.000Z",
      evidenceId: "" as const,
      evidenceStrength: "" as const,
      lawyerName: "",
      lawyerOab: "",
      lawyerSource: "",
      lawyerSourceUrl: "",
      lawyerSourceStatus: "" as const,
      context: "Imported candidate only; beneficiary relationship and current-holder status unverified.",
    });
    expect((await recordImportedBeneficiarySnapshot(imported("Maria Ester Rosa"), f.client)).status).toBe("ADDED");
    expect((await recordImportedBeneficiarySnapshot(imported("Marta Diniz Rosa"), f.client)).status).toBe("ADDED");
    expect((await recordImportedBeneficiarySnapshot(imported("Maria Ester Rosa"), f.client)).status).toBe("ALREADY_PRESENT");

    const saved = await getOperation(f.operation.id, f.client, f.organizationId);
    expect(saved?.workflow.client.name).toBe("Maria Ester Rosa; Marta Diniz Rosa");
    expect(saved?.workflow.client.beneficiaries.map((item) => item.name)).toEqual(["Maria Ester Rosa", "Marta Diniz Rosa"]);
    expect(saved?.workflow.client.beneficiaries.every((item) => item.status === "UNVERIFIED_IMPORT" && item.role === "UNKNOWN" && !item.evidenceId)).toBe(true);
    expect(await listOfficialEvidence(f.operation.id, f.organizationId, f.client)).toHaveLength(1);
    f.client.close();
  });

  it("reconciles corrected source provenance without duplicating the beneficiary assertion", async () => {
    const f = await fixture();
    const original = observation(f, "Nelson Barthelson", "PMC.2021.00051365-07");
    await recordHistoricalBeneficiaryObservation(original, f.client);
    const correctedUrl = "https://portal-adm.campinas.sp.gov.br/publication-4444946.pdf";
    const correctedDocument = await recordOfficialEvidence({
      organizationId: f.organizationId, operationId: f.operation.id, documentType: "OFFICIAL_RECORD",
      title: "Diário Oficial de Campinas — PDF 4444946", source: "Diário Oficial de Campinas",
      sourceUrl: correctedUrl, downloadUrl: "", documentIdentifier: "PMC.2021.00051365-07",
      reference: "PMC.2021.00051365-07", publishedAt: "", page: 34, hash: "", contentFingerprint: "",
      status: "COLLECTED", evidenceStrength: "MEDIUM", notes: "Titular listado no DEPRE exato; vínculo histórico.",
      sourceProvenance: { provider: "OFFICIAL_PDF_FETCH", sourceId: "campinas-diario-oficial", route: "official-publication-pdf" },
      idempotencyKey: "beneficiary-provenance-correction",
    }, f.client);
    const reconciled = await recordHistoricalBeneficiaryObservation({
      ...original,
      sourceUrl: correctedUrl,
      provider: "OFFICIAL_PDF_FETCH",
      route: "official-publication-pdf",
      evidenceId: correctedDocument.id,
    }, f.client);

    expect(reconciled.status).toBe("RECONCILED");
    const saved = await getOperation(f.operation.id, f.client, f.organizationId);
    expect(saved?.workflow.client.beneficiaries).toHaveLength(1);
    expect(saved?.workflow.client.beneficiaries[0]).toMatchObject({
      name: "Nelson Barthelson", sourceUrl: correctedUrl, evidenceId: correctedDocument.id,
    });
    f.client.close();
  });

  it("reconciles a corrected source role in place without creating another beneficiary", async () => {
    const f = await fixture();
    const input = observation(f, "Elson de Souza Moura", "Edital 002/2024-SF");
    await recordHistoricalBeneficiaryObservation(input, f.client);
    const corrected = await recordHistoricalBeneficiaryObservation({ ...input, role: "CREDOR" }, f.client);
    const saved = await getOperation(f.operation.id, f.client, f.organizationId);

    expect(corrected.status).toBe("RECONCILED");
    expect(saved?.workflow.client.beneficiaries).toHaveLength(1);
    expect(saved?.workflow.client.beneficiaries[0].role).toBe("CREDOR");
    f.client.close();
  });
});
