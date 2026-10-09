import { beforeEach, describe, expect, it } from "vitest";
import { aiPilotRunOwnsItem, clearAiPilotRunsForTests, recordAiPilotRun } from "./ai-pilot-run-store";

describe("AI pilot run ownership", () => {
  beforeEach(() => clearAiPilotRunsForTests());

  it("binds an inference attempt to its tenant and evaluated corpus item", () => {
    recordAiPilotRun({ id: "run-a", organizationId: "tenant-a", corpusItemIds: ["item-a"] });

    expect(aiPilotRunOwnsItem("run-a", "tenant-a", "item-a")).toBe(true);
    expect(aiPilotRunOwnsItem("run-a", "tenant-b", "item-a")).toBe(false);
    expect(aiPilotRunOwnsItem("run-a", "tenant-a", "item-b")).toBe(false);
  });

  it("denies nonexistent run identifiers", () => {
    expect(aiPilotRunOwnsItem("forged-run", "tenant-a", "item-a")).toBe(false);
  });
});
