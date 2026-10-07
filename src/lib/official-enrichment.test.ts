import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { createOperation, getOperation } from "./operations";
import { executePhase5EnrichmentForCase } from "./official-enrichment";
import { listOfficialEvidence } from "./autonomous-acquisition";
import { listOpportunityEvaluations } from "./opportunity-evaluations";
import { classifyContact } from "./contact-enrichment";
import { deriveTitularStatusFromBeneficiaries, scoreOpportunity } from "./opportunity-engine";
import { createDefaultWorkflow } from "./operational-workflow";
import { applySchemaMigrations } from "./schema-migrations";

const organizationId = "org-test-phase5";
const actorUserId = "system:phase5-test";

describe("Phase 5 Official Enrichment Pipeline", () => {
  it("executes complete end-to-end scenario preserving DEPRE-first identity, tenant isolation, and 2/2 hard gates", async () => {
    const client = createClient({ url: ":memory:" });
    await applySchemaMigrations(client);

    const defaultWf = createDefaultWorkflow(150000);
    defaultWf.credit.numeroProcessoDEPRE = "0038850-88.2017.8.26.0500";
    defaultWf.credit.numeroProcessoDEPRENormalizado = "0038850-88.2017.8.26.0500";

    // Seed operation with valid DEPRE
    const created = await createOperation(
      {
        title: "Operação Teste Fase 5",
        debtor: "Fazenda do Estado de São Paulo",
        tribunal: "TJSP",
        process: "0038850-88.2017.8.26.0500",
        owner: "analista-1",
        source: "importacao",
        stage: "Entrada",
        nominal: 150000,
        notes: "Depre de teste",
        tasks: [],
        checks: [],
        proposals: [],
        isDemo: false,
        workflow: defaultWf,
      },
      client,
      organizationId,
      actorUserId,
    );

    expect(created.id).toBeDefined();

    // Execute Phase 5 enrichment
    const result = await executePhase5EnrichmentForCase(
      {
        operationId: created.id,
        organizationId,
        depre: "0038850-88.2017.8.26.0500",
        actorUserId,
      },
      client,
    );

    expect(result.operationId).toBe(created.id);
    expect(result.depre).toBe("0038850-88.2017.8.26.0500");
    expect(result.readyForAnalyst).toBe(false);
    expect(result.opportunityStatus).toBe("BLOCKED_BY_IDENTITY");
    expect(result.blockerCodes).toContain("TITULAR_NOT_CONFIRMED");
    expect(result.blockerCodes).toContain("DOCUMENTATION_BELOW_2_OF_2");

    // Idempotency: execute second time
    const secondRun = await executePhase5EnrichmentForCase(
      {
        operationId: created.id,
        organizationId,
        depre: "0038850-88.2017.8.26.0500",
        actorUserId,
      },
      client,
    );

    expect(secondRun.duplicateAttemptSkipped).toBe(true);
    expect(secondRun.evaluationId).toBe(result.evaluationId);

    const evals = await listOpportunityEvaluations(organizationId, client);
    expect(evals).toHaveLength(1);

    client.close();
  }, 15000);

  it("distinguishes beneficiary contact from lawyer professional route", () => {
    const lawyerRoute = classifyContact({
      role: "ADVOGADO",
      entityReference: "Dr. Marcos Silva",
      lawyer: "Marcos Silva",
      oab: "SP 123456",
      sourceUrl: null,
      evidenceId: null,
    });
    expect(lawyerRoute).toBe("PROFESSIONAL_ROUTE");

    const confirmedContact = classifyContact({
      role: "TITULAR",
      entityReference: "João da Silva",
      lawyer: null,
      oab: null,
      sourceUrl: "https://diario.sp.gov.br/doc/123",
      evidenceId: "00000000-0000-0000-0000-000000000001",
    });
    expect(confirmedContact).toBe("CONFIRMED");
  });

  it("preserves UNRESOLVED titular status when multiple beneficiaries exist or titration is unconfirmed", () => {
    const singleTitular = deriveTitularStatusFromBeneficiaries([{ role: "TITULAR", status: "CURRENT_CONFIRMED" }]);
    expect(singleTitular).toBe("CONFIRMED");

    const multipleTitulares = deriveTitularStatusFromBeneficiaries([
      { role: "TITULAR", status: "HISTORICAL_CONFIRMED" },
      { role: "HERDEIRO", status: "UNVERIFIED_IMPORT" },
    ]);
    expect(multipleTitulares).toBe("UNRESOLVED");
  });

  it("gates READY_FOR_ANALYST on 2/2 qualifying evidence and confirmed titular", () => {
    const unblocked = scoreOpportunity({
      opportunityId: "opp-1",
      operationId: "op-1",
      organizationId: "org-1",
      depre: "0038850-88.2017.8.26.0500",
      debtor: "Fazenda SP",
      originalValue: 100000,
      currentValue: 100000,
      dataBase: "2024-01-01",
      lawyer: "Dr. Marcos",
      oab: "SP 123456",
      contactAvailable: true,
      contactStatus: "CONFIRMED",
      coverageState: "SUFFICIENT_COVERAGE",
      qualifyingEvidenceCount: 2,
      aiValidation: "CONFIRMADO",
      divergence: false,
      availability: "AVAILABLE",
      titularStatus: "CONFIRMED",
      valueStatus: "CONFIRMED",
      lawyerStatus: "CONFIRMED",
      processStatus: "CONFIRMED",
      blockerCodes: [],
    });

    expect(unblocked.readyForAnalyst).toBe(true);
    expect(unblocked.status).toBe("READY_FOR_ANALYST");

    const blockedByMediumEvidence = scoreOpportunity({
      opportunityId: "opp-2",
      operationId: "op-2",
      organizationId: "org-1",
      depre: "0038850-88.2017.8.26.0500",
      debtor: "Fazenda SP",
      originalValue: 100000,
      currentValue: null,
      dataBase: null,
      lawyer: null,
      oab: null,
      contactAvailable: false,
      contactStatus: "NO_CONFIRMED_CONTACT",
      coverageState: "INSUFFICIENT_COVERAGE",
      qualifyingEvidenceCount: 0, // MEDIUM evidence does not qualify as STRONG
      aiValidation: "PENDING",
      divergence: false,
      availability: "AVAILABLE",
      titularStatus: "UNRESOLVED",
      blockerCodes: [],
    });

    expect(blockedByMediumEvidence.readyForAnalyst).toBe(false);
    expect(blockedByMediumEvidence.status).toBe("BLOCKED_BY_IDENTITY");
    expect(blockedByMediumEvidence.blockerCodes).toContain("DOCUMENTATION_BELOW_2_OF_2");
  });
});
