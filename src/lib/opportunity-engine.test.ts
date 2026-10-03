import { describe, expect, it } from "vitest";
import { filterOpportunities, scoreOpportunity, transitionOpportunityLifecycle, type OpportunityInput } from "./opportunity-engine";

const base: OpportunityInput = { opportunityId: "opp-1", operationId: "op-1", organizationId: "org-1", depre: "D-1", debtor: "TJSP", originalValue: 100, currentValue: null, dataBase: null, lawyer: "Dr. A", oab: "1", contactAvailable: true, coverageState: "SUFFICIENT_COVERAGE", qualifyingEvidenceCount: 2, aiValidation: "CONFIRMADO", divergence: false, availability: "AVAILABLE" };

describe("opportunity engine", () => {
  it("scores deterministically without collapsing original/current value", () => {
    const first = scoreOpportunity(base);
    expect(first).toEqual(scoreOpportunity(base));
    expect(first.currentValue).toBeNull();
    expect(first.originalValue).toBe(100);
    expect(first.priority).toBe("HIGH");
  });
  it("surfaces review alerts and filters tenant-local derived objects", () => {
    const review = scoreOpportunity({ ...base, organizationId: "org-2", qualifyingEvidenceCount: 1, coverageState: "PARTIAL_COVERAGE", divergence: true, contactAvailable: false });
    expect(review.priority).toBe("REVIEW");
    expect(review.alerts).toEqual(expect.arrayContaining(["DIVERGENCE_DETECTED", "DOCUMENTATION_BELOW_2_OF_2", "MISSING_CONTACT_ROUTE"]));
    expect(filterOpportunities([scoreOpportunity(base), review], { priority: "HIGH" })).toHaveLength(1);
  });
  it("keeps missing facts unresolved and exposes an auditable explanation", () => {
    const result = scoreOpportunity({ ...base, qualifyingEvidenceCount: 0, originalValue: null, lawyer: null, oab: null, dataBase: null, contactStatus: "NO_CONFIRMED_CONTACT", contactAvailable: false, valueStatus: "MISSING", titularStatus: "UNRESOLVED", coverageState: "INSUFFICIENT_COVERAGE", researchStatus: "MANUAL_REQUIRED", aiValidation: "PENDING" });
    expect(result.score).toBe(0);
    expect(result.documentationStatus).toBe("0/2");
    expect(result.readyForAnalyst).toBe(false);
    expect(result.blockingReasons).toEqual(expect.arrayContaining(["TITULAR_NOT_CONFIRMED", "DOCUMENTATION_INSUFFICIENT", "MANUAL_RESEARCH_REQUIRED"]));
    expect(result.evaluationVersion).toBe("opportunity-rules-v1");
  });
  it("requires the complete deterministic readiness contract", () => {
    const result = scoreOpportunity({ ...base, titularStatus: "CONFIRMED", contactStatus: "PROFESSIONAL_ROUTE", contactAvailable: true, coverageState: "SUFFICIENT_COVERAGE", qualifyingEvidenceCount: 2, divergence: false });
    expect(result.readyForAnalyst).toBe(true);
    expect(result.positiveSignals).toEqual(expect.arrayContaining(["DOCUMENTATION_2_OF_2", "PROFESSIONAL_ROUTE_AVAILABLE", "SOURCE_COVERAGE_SUFFICIENT"]));
    expect(result).toEqual(scoreOpportunity({ ...base, titularStatus: "CONFIRMED", contactStatus: "PROFESSIONAL_ROUTE", contactAvailable: true, coverageState: "SUFFICIENT_COVERAGE", qualifyingEvidenceCount: 2, divergence: false }));
  });
  it("enforces auditable lifecycle transitions and real activity for CONTACTED", () => {
    const opportunity = scoreOpportunity({ ...base, lifecycle: "CONTACT_PENDING" });
    expect(() => transitionOpportunityLifecycle(opportunity, "CONTACTED")).toThrow("INVALID_OPPORTUNITY_LIFECYCLE_TRANSITION");
    expect(transitionOpportunityLifecycle(opportunity, "CONTACTED", { hasRecordedActivity: true }).lifecycle).toBe("CONTACTED");
    expect(() => transitionOpportunityLifecycle(opportunity, "CLOSED")).toThrow("INVALID_OPPORTUNITY_LIFECYCLE_TRANSITION");
  });
});
