import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";
import { buildAiReconfirmationRequest, readAiReconfirmationAttemptForBenchmark } from "../src/lib/ai-reconfirmation";
import { buildProviderRequest, estimateTokensFromBytes, resolveAIProvider } from "../src/lib/ai/ai-provider";

const PILOT_DEPRE = "0038850-88.2017.8.26.0500";
const SECOND_PILOT_RUN_ID = "f6302d0d-d0d6-40a9-b95e-f018ce2b5d8f";
const args = process.argv.slice(2);
const option = (name: string, fallback: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || fallback;
const providerId = option("provider", "openai");
const runId = option("run-id", SECOND_PILOT_RUN_ID);
const showPayload = args.includes("--show-payload");

async function main() {
  const client = createClient({ url: requireExplicitDatabaseUrl(), authToken: process.env.DATABASE_AUTH_TOKEN });
  try {
    const attempt = await readAiReconfirmationAttemptForBenchmark(runId, client);
    if (!attempt) throw new Error("BENCHMARK_ATTEMPT_NOT_FOUND");
    const depre = attempt.originalSnapshot.workflow.credit.numeroProcessoDEPRE;
    if (depre !== PILOT_DEPRE) throw new Error("BENCHMARK_DEPRE_MISMATCH");

    const storage = {
      async createPrivateAccess(id: string, organizationId: string) {
        const result = await client.execute({
          sql: "SELECT hash,version,status,content FROM operation_documents WHERE id=? AND organization_id=? LIMIT 1",
          args: [id, organizationId],
        });
        const row = result.rows[0];
        if (!row || ["REJECTED", "ARCHIVED"].includes(String(row.status))) return null;
        const bytes = row.content instanceof Uint8Array ? row.content : new Uint8Array(row.content as ArrayBuffer);
        return {
          metadata: { hash: String(row.hash), version: Number(row.version) },
          bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
        };
      },
    };
    const request = await buildAiReconfirmationRequest(attempt, storage);
    const provider = resolveAIProvider(providerId, false);
    const providerRequest = buildProviderRequest(provider, request.prompt, request.system, request.schema);
    const requestBody = JSON.stringify(providerRequest.body);
    const validationSchema = request.schema.toJSONSchema();
    const responseFormat = providerRequest.body.response_format as { json_schema?: { schema?: unknown } } | undefined;
    const providerSchema = responseFormat?.json_schema?.schema ?? null;
    const validationSchemaJson = JSON.stringify(validationSchema);
    const providerSchemaJson = providerSchema === null ? "" : JSON.stringify(providerSchema);
    const promptBytes = Buffer.byteLength(request.prompt, "utf8");
    const systemBytes = Buffer.byteLength(request.system, "utf8");
    const contextBytes = Buffer.byteLength(request.contextJson, "utf8");
    const validationSchemaBytes = Buffer.byteLength(validationSchemaJson, "utf8");
    const providerSchemaBytes = Buffer.byteLength(providerSchemaJson, "utf8");
    const inputTokenBytes = promptBytes + systemBytes + providerSchemaBytes;
    const estimatedInputTokens = estimateTokensFromBytes(inputTokenBytes);
    const maxOutputTokens = 4096;
    const pricing = provider.provider === "openai"
      ? { currency: "USD", inputPerMillion: 0.05, outputPerMillion: 0.4, source: "https://developers.openai.com/api/docs/pricing" }
      : provider.provider === "deepseek"
        ? { currency: "USD", offPeakInputPerMillion: 0.15, offPeakOutputPerMillion: 0.6, peakInputPerMillion: 0.3, peakOutputPerMillion: 1.2, source: "https://api-docs.deepseek.com/quick_start/pricing" }
        : null;
    const cost = (inputRate: number, outputRate: number) => Number(((estimatedInputTokens * inputRate + maxOutputTokens * outputRate) / 1_000_000).toFixed(8));
    const estimatedMaxCostUsd = provider.provider === "openai"
      ? cost(0.05, 0.4)
      : provider.provider === "deepseek"
        ? { offPeak: cost(0.15, 0.6), peak: cost(0.3, 1.2) }
        : null;

    const report = {
      mode: "DRY_RUN_NO_NETWORK_NO_DATABASE_WRITES",
      attemptId: attempt.id,
      attemptStatus: attempt.status,
      depre,
      promptVersion: attempt.promptVersion,
      provider: provider.provider,
      model: provider.model,
      endpoint: provider.endpoint,
      promptSizeBytes: promptBytes,
      systemSizeBytes: systemBytes,
      contextSizeBytes: contextBytes,
      validationSchemaSizeBytes: validationSchemaBytes,
      providerSchemaSizeBytes: providerSchemaBytes,
      estimatedInputTokens,
      maxOutputTokens,
      pricing,
      estimatedMaxCostUsd,
      validationSchema,
      providerEnforcedSchema: providerSchema,
      structuredOutputMode: provider.structuredOutputMode,
      timeoutMs: provider.timeoutMs,
      maxRetries: provider.maxRetries,
      documentCount: request.documents.length,
      requestBodyBytes: Buffer.byteLength(requestBody, "utf8"),
      requestBodySha256: createHash("sha256").update(requestBody).digest("hex"),
      ...(showPayload ? { requestBody: providerRequest.body } : {}),
    };
    console.log(JSON.stringify(report, null, 2));
  } finally {
    client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "BENCHMARK_DRY_RUN_FAILED");
  process.exitCode = 1;
});
