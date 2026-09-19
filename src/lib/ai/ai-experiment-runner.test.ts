import { describe, expect, it, vi } from "vitest";
import { runRealPilotExperiment } from "./ai-experiment-runner";

describe("Real Pilot Experiment Runner & Readiness Gate", () => {
  it("stops execution and reports BLOCKED status when Ollama is offline", async () => {
    // Force Ollama to appear offline by mocking fetch
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    global.fetch = mockFetch;

    const result = await runRealPilotExperiment({
      experimentId: "CP24-PILOT-001",
      promptVersion: "v1"
    });

    expect(result.experimentId).toBe("CP24-PILOT-001");
    expect(result.readinessGateStatus).toBe("BLOCKED");
    expect(result.readinessGateReason).toBe("OLLAMA_OFFLINE");
    expect(result.model).toBe("qwen3:4b");
    expect(result.provider).toBe("Ollama (Local)");
    expect(result.scorecard).toBeUndefined(); // Must NOT produce mock responses pretending to come from Qwen
  });

  it("classifies task status accurately and separates corpus composition", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 502 });
    global.fetch = mockFetch;

    const result = await runRealPilotExperiment({
      experimentId: "CP24-PILOT-002",
      promptVersion: "v2"
    });

    expect(result.corpusComposition.totalCases).toBeGreaterThan(0);
    expect(result.taskAssignedStatus.CREDITOR_CANDIDATE_EXTRACTION).toBeDefined();
    expect(result.taskAssignedStatus.DOCUMENT_SUMMARY).toBe("VALIDATED_FOR_ASSISTED_USE");
  });
});
