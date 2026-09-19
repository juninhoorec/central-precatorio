import { z } from "zod";
import { resolveCreditor, type CreditorCandidateInput, type CreditorResolutionAttempt, recordCreditorResolutionAttempt, initializeCreditorResolution } from "./creditor-resolution";
import { type Client } from "@libsql/client";

export const batchResolutionJobSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string(),
  actorUserId: z.string(),
  status: z.enum(["RUNNING", "COMPLETED", "FAILED", "PARTIAL_COMPLETION"]),
  totalRecords: z.number().int().nonnegative(),
  processedRecords: z.number().int().nonnegative(),
  metrics: z.object({
    identified: z.number().int().nonnegative().default(0),
    corroborated: z.number().int().nonnegative().default(0),
    partial: z.number().int().nonnegative().default(0),
    possible: z.number().int().nonnegative().default(0),
    conflict: z.number().int().nonnegative().default(0),
    notFound: z.number().int().nonnegative().default(0),
    assistedRequired: z.number().int().nonnegative().default(0),
    errors: z.number().int().nonnegative().default(0),
    sourceUnavailable: z.number().int().nonnegative().default(0)
  }),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
}).strict();

export type BatchResolutionJob = z.infer<typeof batchResolutionJobSchema>;

export type BatchResolutionItem = {
  operationId: string;
  identifiers: {
    numeroProcessoDEPRE: string;
    epes: string;
    originProcessNumber: string;
    precatoryNumber: string;
    debtor: string;
  };
  existingCreditorName?: string;
};

// Represents a pluggable source strategy
export interface CreditorSourceStrategy {
  name: string;
  url: string;
  supportsDEPRE: boolean;
  supportsOriginProcess: boolean;
  execute(item: BatchResolutionItem): Promise<{
    queryKind: "PROCESSO_DEPRE" | "EPES" | "PROCESSO_ORIGINARIO" | "PRECATORIO" | "PARTES" | "CPF";
    queryValue: string;
    queryState: "RESULTS_FOUND" | "RESULT_ZERO" | "ACCESS_FAILED" | "REQUIRES_ASSISTED_ACTION";
    resultCount: number;
    candidates: CreditorCandidateInput[];
  }>;
}

export async function processBatchResolution(
  items: BatchResolutionItem[],
  sources: CreditorSourceStrategy[],
  jobId: string,
  organizationId: string,
  actorUserId: string,
  client: Client
): Promise<BatchResolutionJob> {
  const now = new Date().toISOString();
  const job: BatchResolutionJob = {
    id: jobId,
    organizationId,
    actorUserId,
    status: "RUNNING",
    totalRecords: items.length,
    processedRecords: 0,
    metrics: { identified: 0, corroborated: 0, partial: 0, possible: 0, conflict: 0, notFound: 0, assistedRequired: 0, errors: 0, sourceUnavailable: 0 },
    createdAt: now,
    updatedAt: now,
  };

  await initializeCreditorResolution(client);

  for (const item of items) {
    let resolved = false;
    for (const source of sources) {
      try {
        const result = await source.execute(item);
        const attemptResult = await recordCreditorResolutionAttempt({
          operationId: item.operationId,
          idempotencyKey: `batch-${jobId}-${item.operationId}-${source.name}`,
          identifiers: item.identifiers,
          existingCreditorName: item.existingCreditorName,
          source: source.name,
          sourceUrl: source.url,
          mode: result.queryState === "REQUIRES_ASSISTED_ACTION" ? "ASSISTED_CAPTURE" : "PUBLIC_LOOKUP",
          queryKind: result.queryKind,
          queryValue: result.queryValue,
          queryState: result.queryState,
          resultCount: result.resultCount,
          candidates: result.candidates,
          organizationId,
          actorUserId,
        }, client);

        const state = attemptResult.attempt.state;
        if (state === "CREDOR_IDENTIFICADO") job.metrics.identified++;
        else if (state === "CREDOR_CORROBORADO") job.metrics.corroborated++;
        else if (state === "CREDOR_PARCIALMENTE_IDENTIFICADO") job.metrics.partial++;
        else if (state === "POSSÍVEL_CORRESPONDÊNCIA") job.metrics.possible++;
        else if (state === "CONFLITO_DE_IDENTIDADE") job.metrics.conflict++;
        else if (state === "CREDOR_NÃO_IDENTIFICADO") job.metrics.notFound++;
        else if (state === "REVISÃO_HUMANA") job.metrics.assistedRequired++;
        else if (state === "FONTE_INDISPONÍVEL") job.metrics.sourceUnavailable++;

        // Wait a bit to respect rate limits (controlled concurrency)
        await new Promise(resolve => setTimeout(resolve, 100)); // Sleep for 100ms
        resolved = true;
        break; // Stop at first source that completes an attempt (or refine logic to try others if failed)
      } catch (err) {
        console.error("Batch error:", err);
        job.metrics.errors++;
      }
    }
    if (!resolved) {
      job.metrics.errors++;
    }
    job.processedRecords++;
  }

  job.status = job.metrics.errors > 0 ? "PARTIAL_COMPLETION" : "COMPLETED";
  job.updatedAt = new Date().toISOString();
  return job;
}
