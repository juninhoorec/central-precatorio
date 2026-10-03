import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { initializeAutonomousAcquisition, listOfficialEvidence } from "./autonomous-acquisition";
import { createDefaultWorkflow } from "./operational-workflow";
import { createOperation } from "./operations";
import type { EvidenceCandidate, ResolvedEvidence } from "./research-pipeline";
import { persistResolvedOfficialEvidence } from "./evidence-persistence";

async function fixture() {
  const client = createClient({ url: ":memory:" });
  const organizationId = "persistence-org";
  const operation = await createOperation({
    title: "Fixture de persistência", debtor: "Município fixture", tribunal: "TJSP",
    process: "0038850-88.2017.8.26.0500", owner: "", source: "fixture", stage: "Entrada",
    nominal: 100000, notes: "isolado", tasks: [], checks: [], proposals: [],
    workflow: createDefaultWorkflow(100000), isDemo: false,
  }, client, organizationId, "fixture-user");
  await initializeAutonomousAcquisition(client);
  return { client, organizationId, operation, operationId: operation.id };
}

function candidate(overrides: Partial<EvidenceCandidate> = {}): EvidenceCandidate {
  return {
    acquisitionResultRef: { provider: "TJSP", source: "TJSP", sourceId: "tjsp-processual", route: "cpopg", sourceUrl: "https://www.tjsp.jus.br/query" },
    documentType: "OFFICIAL_RECORD", documentIdentifier: "DOC-NEW", reference: "REF-NEW",
    officialSourceUrl: "https://www.tjsp.jus.br/documento", contentHash: "", contentFingerprint: "fp-new", rawPayload: { fixture: true },
    title: "Documento novo", status: "COLLECTED", evidenceStrength: "MEDIUM", notes: "fixture", ...overrides,
  };
}

function unresolved(candidateValue: EvidenceCandidate): ResolvedEvidence {
  return { evidenceId: null, candidate: candidateValue, resolutionReason: "UNRESOLVED", unresolvedReason: "fixture", qualifiesForDocumentation: false, qualificationRationale: "fixture" };
}

describe("official evidence persistence boundary", () => {
  it("persists a valid unresolved candidate once and is idempotent across three runs", async () => {
    const f = await fixture();
    const input = unresolved(candidate({ idempotencyKey: "fixture-persist-once" }));
    const first = await persistResolvedOfficialEvidence(input, f);
    const second = await persistResolvedOfficialEvidence(input, f);
    const third = await persistResolvedOfficialEvidence(input, f);
    expect(first.status).toBe("PERSISTED");
    expect(second.status).toBe("PERSISTED");
    expect(third.status).toBe("PERSISTED");
    expect(await listOfficialEvidence(f.operation.id, f.organizationId, f.client)).toHaveLength(1);
    f.client.close();
  });

  it("reuses resolved evidence without inserting or mutating it", async () => {
    const f = await fixture();
    const created = await persistResolvedOfficialEvidence(unresolved(candidate({ idempotencyKey: "fixture-existing" })), f);
    if (created.status !== "PERSISTED") throw new Error("fixture setup failed");
    const before = await listOfficialEvidence(f.operation.id, f.organizationId, f.client);
    const reused = await persistResolvedOfficialEvidence({ ...unresolved(candidate({ title: "conflicting title" })), evidenceId: created.evidence.id, resolutionReason: "HASH_MATCH" }, f, before);
    expect(reused).toMatchObject({ status: "REUSED", evidence: { id: created.evidence.id, title: "Documento novo" } });
    expect(await listOfficialEvidence(f.operation.id, f.organizationId, f.client)).toEqual(before);
    f.client.close();
  });

  it("rejects missing identity, URL, and persistence metadata without inserting", async () => {
    const f = await fixture();
    expect((await persistResolvedOfficialEvidence(unresolved(candidate({ documentIdentifier: null, reference: null })), f)).status).toBe("REJECTED");
    expect((await persistResolvedOfficialEvidence(unresolved(candidate({ officialSourceUrl: null })), f)).status).toBe("REJECTED");
    expect((await persistResolvedOfficialEvidence(unresolved(candidate({ title: undefined, status: undefined, evidenceStrength: undefined })), f)).status).toBe("REJECTED");
    expect(await listOfficialEvidence(f.operation.id, f.organizationId, f.client)).toHaveLength(0);
    f.client.close();
  });

  it("preserves document type, status, strength, identifiers, provenance, and does not qualify automatically", async () => {
    const f = await fixture();
    const result = await persistResolvedOfficialEvidence(unresolved(candidate({ documentType: "OFFICIAL_RECORD", status: "COLLECTED", evidenceStrength: "MEDIUM" })), f);
    expect(result).toMatchObject({ status: "PERSISTED", evidence: {
      documentType: "OFFICIAL_RECORD", status: "COLLECTED", evidenceStrength: "MEDIUM",
      source: "TJSP", sourceUrl: "https://www.tjsp.jus.br/documento", documentIdentifier: "DOC-NEW", reference: "REF-NEW", hash: "",
      sourceProvenance: { provider: "TJSP", sourceId: "tjsp-processual", route: "cpopg" },
    } });
    f.client.close();
  });
});
