import { describe, expect, it } from "vitest";
import { deriveTitularStatusFromBeneficiaries, filterOpportunities, scoreOpportunity, transitionOpportunityLifecycle, type OpportunityInput } from "./opportunity-engine";

const base: OpportunityInput = {
  opportunityId: "opp-1",
  operationId: "op-1",
  organizationId: "org-1",
  depre: "D-1",
  debtor: "TJSP",
  originalValue: 100,
  currentValue: null,
  dataBase: "2024-01-01",
  lawyer: "Dr. A",
  oab: "1",
  contactAvailable: true,
  coverageState: "SUFFICIENT_COVERAGE",
  qualifyingEvidenceCount: 2,
  aiValidation: "CONFIRMADO",
  divergence: false,
  availability: "AVAILABLE",
  titularStatus: "CONFIRMED",
  valueStatus: "CONFIRMED",
  lawyerStatus: "CONFIRMED",
  contactStatus: "CONFIRMED",
  processStatus: "CONFIRMED",
  status: "READY_FOR_ANALYST",
};

describe("opportunity engine", () => {
  it("scores deterministically without collapsing original/current value", () => {
    const first = scoreOpportunity(base);
    expect(first).toEqual(scoreOpportunity(base));
    expect(first.currentValue).toBeNull();
    expect(first.originalValue).toBe(100);
    expect(first.priority).toBe("HIGH");
  });

  it("surfaces review alerts and filters tenant-local derived objects", () => {
    const review = scoreOpportunity({
      ...base,
      organizationId: "org-2",
      qualifyingEvidenceCount: 1,
      coverageState: "PARTIAL_COVERAGE",
      divergence: true,
      contactAvailable: false,
      contactStatus: "NO_CONFIRMED_CONTACT",
      blockerCodes: ["DOCUMENTATION_BELOW_2_OF_2", "CONTACT_NOT_CONFIRMED"],
    });
    expect(review.priority).toBe("REVIEW");
    expect(review.alerts).toEqual(expect.arrayContaining(["DIVERGENCE_DETECTED", "DOCUMENTATION_BELOW_2_OF_2", "MISSING_CONTACT_ROUTE"]));
    expect(filterOpportunities([scoreOpportunity(base), review], { priority: "HIGH" })).toHaveLength(1);
  });

  it("keeps missing facts unresolved and exposes an auditable explanation", () => {
    const result = scoreOpportunity({
      ...base,
      qualifyingEvidenceCount: 0,
      originalValue: null,
      lawyer: null,
      oab: null,
      dataBase: null,
      contactStatus: "NO_CONFIRMED_CONTACT",
      contactAvailable: false,
      valueStatus: "MISSING",
      titularStatus: "UNRESOLVED",
      coverageState: "NO_RESULT",
      researchStatus: "MANUAL_REQUIRED",
      aiValidation: "PENDING",
      processStatus: "PENDING",
      status: "BLOCKED_BY_IDENTITY",
      blockerCodes: ["TITULAR_NOT_CONFIRMED", "DOCUMENTATION_BELOW_2_OF_2", "INSUFFICIENT_SOURCE_COVERAGE", "VALUE_NOT_CONFIRMED", "PROCESS_NOT_CONFIRMED"],
    });
    expect(result.score).toBe(0);
    expect(result.documentationStatus).toBe("0/2");
    expect(result.readyForAnalyst).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining(["TITULAR_NOT_CONFIRMED", "DOCUMENTATION_INSUFFICIENT", "INSUFFICIENT_SOURCE_COVERAGE", "VALUE_NOT_CONFIRMED"]));
    expect(result.evaluationVersion).toBe("opportunity-rules-v3");
  });

  it("requires the complete deterministic readiness contract", () => {
    const result = scoreOpportunity({
      ...base,
      titularStatus: "CONFIRMED",
      contactStatus: "PROFESSIONAL_ROUTE",
      contactAvailable: true,
      coverageState: "SUFFICIENT_COVERAGE",
      qualifyingEvidenceCount: 2,
      divergence: false,
      processStatus: "CONFIRMED",
      status: "READY_FOR_ANALYST",
    });
    expect(result.readyForAnalyst).toBe(true);
    expect(result.positiveSignals).toEqual(expect.arrayContaining(["DOCUMENTATION_2_OF_2", "PROFESSIONAL_ROUTE_AVAILABLE", "SOURCE_COVERAGE_SUFFICIENT"]));
    expect(result).toEqual(scoreOpportunity({
      ...base,
      titularStatus: "CONFIRMED",
      contactStatus: "PROFESSIONAL_ROUTE",
      contactAvailable: true,
      coverageState: "SUFFICIENT_COVERAGE",
      qualifyingEvidenceCount: 2,
      divergence: false,
      processStatus: "CONFIRMED",
      status: "READY_FOR_ANALYST",
    }));
  });

  it("enforces auditable lifecycle transitions and real activity for CONTACTED", () => {
    const opportunity = scoreOpportunity({ ...base, lifecycle: "CONTACT_PENDING" });
    expect(() => transitionOpportunityLifecycle(opportunity, "CONTACTED")).toThrow("INVALID_OPPORTUNITY_LIFECYCLE_TRANSITION");
    expect(transitionOpportunityLifecycle(opportunity, "CONTACTED", { hasRecordedActivity: true }).lifecycle).toBe("CONTACTED");
    expect(() => transitionOpportunityLifecycle(opportunity, "CLOSED")).toThrow("INVALID_OPPORTUNITY_LIFECYCLE_TRANSITION");
  });

  it("keeps hard gates explicit instead of a single opaque score", () => {
    const result = scoreOpportunity({
      ...base,
      titularStatus: "UNRESOLVED",
      qualifyingEvidenceCount: 2,
      coverageState: "SUFFICIENT_COVERAGE",
      dataBase: "2024-01-01",
      processStatus: "CONFIRMED",
      blockerCodes: ["TITULAR_NOT_CONFIRMED"],
    });
    expect(result.blockerCodes).toContain("TITULAR_NOT_CONFIRMED");
    expect(result.status).toBe("BLOCKED_BY_IDENTITY");
    expect(result.readyForAnalyst).toBe(false);
  });

  it("never allows explicit hard blockers to coexist with analyst readiness", () => {
    const result = scoreOpportunity({
      ...base,
      blockerCodes: ["TITULAR_NOT_CONFIRMED"],
    });

    expect(result.readyForAnalyst).toBe(false);
    expect(result.status).not.toBe("READY_FOR_ANALYST");
  });

  it("does not let a legacy ready status replace missing identity confirmation", () => {
    const withoutTitularStatus = { ...base };
    delete withoutTitularStatus.titularStatus;
    const result = scoreOpportunity({
      ...withoutTitularStatus,
      status: "READY_FOR_ANALYST",
    });

    expect(result.readyForAnalyst).toBe(false);
    expect(result.status).not.toBe("READY_FOR_ANALYST");
  });

  it("does not promote historical or imported beneficiary observations to current titular", () => {
    expect(deriveTitularStatusFromBeneficiaries([
      { role: "TITULAR", status: "HISTORICAL_CONFIRMED" },
    ])).toBe("UNRESOLVED");
    expect(deriveTitularStatusFromBeneficiaries([
      { role: "UNKNOWN", status: "UNVERIFIED_IMPORT" },
      { role: "UNKNOWN", status: "UNVERIFIED_IMPORT" },
    ])).toBe("UNRESOLVED");
    expect(deriveTitularStatusFromBeneficiaries([
      { role: "TITULAR", status: "CURRENT_CONFIRMED" },
    ])).toBe("CONFIRMED");
  });
});
