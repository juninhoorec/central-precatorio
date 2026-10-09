import { describe, expect, it } from "vitest";
import { PilotCorpusRepository, pilotCorpusItemSchema } from "./ai-pilot-corpus";
import { HumanReviewStore, humanReviewRecordSchema } from "./ai-human-review";

const itemId = "11111111-1111-4111-8111-111111111111";

describe("AI tenant-scoped repositories", () => {
  it("filters corpus reads and annotations by organization", () => {
    const repository = new PilotCorpusRepository();
    repository.save(pilotCorpusItemSchema.parse({
      id: itemId,
      organizationId: "tenant-a",
      title: "Tenant A corpus case",
      scenarioType: "STRAIGHTFORWARD",
      documentText: "Synthetic content",
    }));

    expect(repository.getAll("tenant-a").map((item) => item.id)).toEqual([itemId]);
    expect(repository.getAll("tenant-b")).toEqual([]);
    expect(repository.getById(itemId, "tenant-b")).toBeUndefined();
    expect(() => repository.annotateGold(itemId, {} as never, "tenant-b")).toThrow("Pilot corpus item");
  });

  it("keeps human review history tenant-scoped", () => {
    const store = new HumanReviewStore();
    store.recordReview(humanReviewRecordSchema.parse({
      id: "22222222-2222-4222-8222-222222222222",
      organizationId: "tenant-a",
      corpusItemId: itemId,
      aiRunId: "33333333-3333-4333-8333-333333333333",
      decision: "INCONCLUSIVO",
      reason: "UNSUPPORTED",
    }));

    expect(store.getAll("tenant-a")).toHaveLength(1);
    expect(store.getAll("tenant-b")).toEqual([]);
    expect(store.getForCorpusItem(itemId, "tenant-b")).toEqual([]);
  });
});
