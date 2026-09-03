import { describe, expect, it } from "vitest";
import { calculatePricing, canTransition, createDefaultWorkflow, nextActionFor } from "./operational-workflow";

describe("workflow operacional", () => {
  it("bloqueia transições arbitrárias", () => {
    expect(canTransition("NEW", "TRIAGE")).toBe(true);
    expect(canTransition("NEW", "COMPLETED")).toBe(false);
    expect(canTransition("NEGOTIATION", "ACCEPTED")).toBe(true);
  });
  it("calcula preço de forma determinística e explicável", () => {
    expect(calculatePricing({ grossAmount: 500000, deductions: 50000, encumbrances: 25000, transactionCosts: 5000, targetMarginPercent: 20 }))
      .toEqual({ availableAmount: 425000, offerAmount: 335000 });
  });
  it("prioriza divergência crítica na próxima ação", () => {
    const workflow = createDefaultWorkflow();
    workflow.validations.push({ id: crypto.randomUUID(), check: "CPF", severity: "CRITICAL", status: "FAILED", explanation: "CPF diverge do documento." });
    expect(nextActionFor(workflow)).toBe("Resolver divergência crítica");
  });
});
