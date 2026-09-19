import { z } from "zod";

export const reviewDecisionSchema = z.enum(["APROVAR", "REJEITAR", "CORRIGIR", "INCONCLUSIVO"]);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

export const reviewReasonSchema = z.enum([
  "CORRECT_EVIDENCE",
  "WRONG_ROLE",
  "WRONG_PAGE",
  "UNSUPPORTED",
  "MODEL_ERROR",
  "SOURCE_CHANGED",
  "HUMAN_CORRECTION"
]);
export type ReviewReason = z.infer<typeof reviewReasonSchema>;

export const humanReviewRecordSchema = z.object({
  id: z.string().uuid(),
  corpusItemId: z.string().uuid(),
  experimentId: z.string().trim().default("CP24-PILOT-001"),
  aiRunId: z.string().uuid(),
  decision: reviewDecisionSchema,
  reason: reviewReasonSchema,
  notes: z.string().trim().default(""),
  reviewer: z.string().trim().default("Analista CP"),
  reviewedAt: z.string().datetime().default(() => new Date().toISOString())
}).strict();

export type HumanReviewRecord = z.infer<typeof humanReviewRecordSchema>;

export class HumanReviewStore {
  private reviews: Map<string, HumanReviewRecord> = new Map();

  recordReview(input: z.infer<typeof humanReviewRecordSchema>): HumanReviewRecord {
    const parsed = humanReviewRecordSchema.parse(input);
    this.reviews.set(parsed.id, parsed);
    return parsed;
  }

  getForCorpusItem(corpusItemId: string): HumanReviewRecord[] {
    return Array.from(this.reviews.values()).filter(r => r.corpusItemId === corpusItemId);
  }

  getAll(): HumanReviewRecord[] {
    return Array.from(this.reviews.values());
  }
}

export const globalHumanReviewStore = new HumanReviewStore();
