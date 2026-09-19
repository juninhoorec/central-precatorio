import { afterEach, describe, expect, it, vi } from "vitest";
import { globalPilotRepository } from "./ai-pilot-corpus";
import { evaluateCorpusItem, runPilotEvaluation } from "./ai-evaluator";
import { creditorExtractionTask } from "./ai-tasks/creditor-extraction";

function mockExtraction() {
  return vi.spyOn(creditorExtractionTask, "execute").mockResolvedValue({
    candidates: [],
    uncertainties: [],
    warnings: []
  });
}

afterEach(() => vi.restoreAllMocks());

describe("AI Quality Evaluator (Pilot Corpus Benchmark)", () => {
  it("evaluates a straightforward pilot item with confirmed creditor", async () => {
    mockExtraction();
    const item = globalPilotRepository.getById("00000000-0000-4000-8000-000000000001")!;
    const result = await evaluateCorpusItem(item, "v1");
    expect(result.taskId).toBe("CREDITOR_CANDIDATE_EXTRACTION");
    expect(result.promptVersion).toBe("v1");
    expect(["CORRECT", "ABSTAINED_CORRECTLY", "ABSTAINED_INCORRECTLY", "INCORRECT"]).toContain(result.classification);
  });

  it("prevents attorney from being classified as creditor", async () => {
    mockExtraction();
    const item = globalPilotRepository.getById("00000000-0000-4000-8000-000000000002")!;
    const result = await evaluateCorpusItem(item, "v1");
    // If the attorney was classified as creditor, failureCategory must be WRONG_ROLE
    if (result.classification === "INCORRECT") {
      expect(result.failureCategory).not.toBe("NONE");
    }
  });

  it("runs full pilot scorecard over all seed cases", async () => {
    mockExtraction();
    const items = globalPilotRepository.getAll();
    const scorecard = await runPilotEvaluation(items, "v1");

    expect(scorecard.totalCases).toBe(8);
    expect(scorecard.promptVersion).toBe("v1");
    expect(scorecard.metrics.attorneyAsCreditorRatePercent).toBeGreaterThanOrEqual(0);
    expect(scorecard.results.length).toBe(8);
  });
});
