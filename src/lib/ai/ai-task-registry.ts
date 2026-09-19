import type { AITaskDefinition } from "./ai-core";
import { creditorExtractionTask } from "./ai-tasks/creditor-extraction";
import { z } from "zod";

// Example of another task for document summary
export const leadSummaryTask: AITaskDefinition<{ text: string }, { summary: string; missing: string[]; nextActions: string[] }> = {
  name: "LEAD_SUMMARY",
  promptVersion: "v1",
  schemaVersion: "v1",
  schema: z.object({
    summary: z.string(),
    missing: z.array(z.string()),
    nextActions: z.array(z.string())
  }),
  policy: {
    evidenceRequired: false,
    humanReviewRequired: false,
    canonicalWriteAllowed: false
  },
  execute: async () => {
    // Mock implementation for structure
    return { summary: "Mock summary", missing: [], nextActions: [] };
  }
};

type TaskRegistryEntry = {
  name: string;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodSchema<unknown>;
  policy: {
    evidenceRequired: boolean;
    humanReviewRequired: boolean;
    canonicalWriteAllowed: boolean;
  };
  execute: (input: unknown) => Promise<unknown>;
};

export const taskRegistry: Record<string, TaskRegistryEntry> = {
  CREDITOR_CANDIDATE_EXTRACTION: creditorExtractionTask as unknown as TaskRegistryEntry,
  LEAD_SUMMARY: leadSummaryTask as unknown as TaskRegistryEntry,
};
