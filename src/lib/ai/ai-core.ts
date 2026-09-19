import { z } from "zod";

export const aiObservationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(["CREDITOR_CANDIDATE", "PARTY_ROLE", "DOCUMENT_SUMMARY", "CONFLICT_EXPLANATION", "NEXT_ACTION", "DATA_MAPPING", "GENERAL"]),
  content: z.any(),
  evidence: z.array(z.object({
    documentId: z.string().optional(),
    page: z.number().optional(),
    textSpan: z.string().trim().max(5000),
    source: z.string().trim().max(500)
  })),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW", "UNKNOWN"]),
  state: z.enum(["REQUIRES_HUMAN_REVIEW", "ACCEPTED", "REJECTED"]),
  createdAt: z.string().datetime()
}).strict();

export type AIObservation = z.infer<typeof aiObservationSchema>;

export const aiRunSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string(),
  model: z.string(),
  provider: z.string(),
  promptVersion: z.string(),
  schemaVersion: z.string(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "REJECTED_VALIDATION"]),
  inputReference: z.string(),
  output: z.any().optional(),
  error: z.string().optional(),
  observations: z.array(aiObservationSchema).default([]),
  humanReviewState: z.enum(["PENDING", "REVIEWED"]).default("PENDING")
}).strict();

export type AIRun = z.infer<typeof aiRunSchema>;

export interface AITaskPolicy {
  evidenceRequired: boolean;
  humanReviewRequired: boolean;
  canonicalWriteAllowed: boolean;
}

export interface AITaskDefinition<Input, Output> {
  name: string;
  promptVersion: string;
  schemaVersion: string;
  schema: z.ZodSchema<Output>;
  policy: AITaskPolicy;
  execute: (input: Input) => Promise<Output>;
}
