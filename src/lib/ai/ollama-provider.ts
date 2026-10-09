import { z } from "zod";

const HEALTH_CACHE_TTL_MS = 15_000;
const FAILED_HEALTH_CACHE_TTL_MS = 3_000;
const HEALTH_TAGS_TIMEOUT_MS = 5_000;
const HEALTH_INFERENCE_TIMEOUT_MS = 90_000;
const MAX_CONCURRENT_AI_JOBS = 1;

export interface AIProviderConfig { baseUrl: string; model: string; timeoutMs: number; maxRetries: number; keepAlive?: string; }

export const defaultConfig: AIProviderConfig = {
  baseUrl: (process.env.CP_AI_BASE_URL || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, ""),
  model: process.env.CP_AI_MODEL || process.env.OLLAMA_MODEL || "qwen3:4b",
  timeoutMs: 120_000,
  maxRetries: 2,
  keepAlive: process.env.OLLAMA_KEEP_ALIVE,
};

type OllamaChatResponse = { message?: { content?: string }; load_duration?: number; };
type HealthPhase = "PENDING" | "OK" | "NOT_RUN" | "FAILED" | "TIMEOUT";
export type AIHealthStatusCode = "OLLAMA_OFFLINE" | "TAGS_TIMEOUT" | "MODEL_NOT_FOUND" | "GENERATION_TIMEOUT" | "GENERATION_FAILED" | "STRUCTURED_OUTPUT_TIMEOUT" | "STRUCTURED_OUTPUT_FAILED" | "TOTAL_HEALTH_TIMEOUT" | "EXTERNAL_DATA_TRANSFER_DISABLED" | "READY";

export interface AIHealthStatus {
  status: AIHealthStatusCode;
  model: string;
  latencyMs: number;
  lastChecked: string;
  failedPhase?: "tags" | "model" | "generation" | "structuredOutput" | "total";
  error?: string;
  retryUsed: boolean;
  coldStart: boolean | null;
  phases: { tags: HealthPhase; model: HealthPhase; generation: HealthPhase; structuredOutput: HealthPhase; };
  timings: { ollamaConnectMs?: number; tagsMs?: number; modelCheckMs?: number; generationMs?: number; structuredOutputMs?: number; totalHealthMs: number; };
}

type HealthOptions = { forceRefresh?: boolean };
let cachedHealth: { value: AIHealthStatus; expiresAt: number } | undefined;
let inFlightHealth: Promise<AIHealthStatus> | undefined;
let aiJobTail: Promise<void> = Promise.resolve();

function now() { return new Date().toISOString(); }
function emptyPhases(): AIHealthStatus["phases"] { return { tags: "PENDING", model: "NOT_RUN", generation: "NOT_RUN", structuredOutput: "NOT_RUN" }; }
function isTimeout(error: unknown) { return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"); }
function externalDataTransferAllowed(config:AIProviderConfig){
  try{
    const endpoint=new URL(config.baseUrl);
    const hostname=endpoint.hostname.replace(/^\[|\]$/g,"").toLowerCase();
    const local=endpoint.protocol==="http:"&&["localhost","127.0.0.1","::1"].includes(hostname)&&!endpoint.username&&!endpoint.password;
    return local||(endpoint.protocol==="https:"&&process.env.CP_AI_ALLOW_EXTERNAL_DATA==="true"&&!endpoint.username&&!endpoint.password);
  }catch{return false}
}

function healthStatus(code: AIHealthStatusCode, start: number, phases: AIHealthStatus["phases"], timings: Omit<AIHealthStatus["timings"], "totalHealthMs">, details: Pick<AIHealthStatus, "failedPhase" | "error" | "retryUsed" | "coldStart">): AIHealthStatus {
  const totalHealthMs = Date.now() - start;
  return { status: code, model: defaultConfig.model, latencyMs: totalHealthMs, lastChecked: now(), phases, timings: { ...timings, totalHealthMs }, ...details };
}

async function runExclusiveAIJob<T>(job: () => Promise<T>): Promise<T> {
  const previous = aiJobTail;
  let release!: () => void;
  aiJobTail = new Promise<void>((resolve) => { release = resolve; });
  await previous;
  try { return await job(); } finally { release(); }
}

function parseChatJson(response: OllamaChatResponse) {
  if (typeof response.message?.content !== "string") throw new Error("Ollama returned an empty chat response");
  return JSON.parse(response.message.content);
}

async function checkOllamaHealthUncached(config: AIProviderConfig): Promise<AIHealthStatus> {
  const startedAt = Date.now();
  const phases = emptyPhases();
  const timings: Omit<AIHealthStatus["timings"], "totalHealthMs"> = {};
  if(!externalDataTransferAllowed(config))return healthStatus("EXTERNAL_DATA_TRANSFER_DISABLED",startedAt,phases,timings,{error:"External AI data transfer is disabled by policy",retryUsed:false,coldStart:null,failedPhase:"tags"});
  let retryUsed = false;
  let coldStart: AIHealthStatus["coldStart"] = null;
  const tagsStartedAt = Date.now();
  let tags: { models?: Array<{ name?: string }> };

  try {
    const response = await fetch(`${config.baseUrl}/api/tags`, { signal: AbortSignal.timeout(HEALTH_TAGS_TIMEOUT_MS), cache: "no-store" });
    timings.tagsMs = Date.now() - tagsStartedAt;
    timings.ollamaConnectMs = timings.tagsMs; // Fetch exposes the tags round-trip, not TCP timing separately.
    if (!response.ok) return healthStatus("OLLAMA_OFFLINE", startedAt, { ...phases, tags: "FAILED" }, timings, { error: `HTTP ${response.status}`, retryUsed, coldStart, failedPhase: "tags" });
    tags = await response.json();
    phases.tags = "OK";
  } catch (error: unknown) {
    timings.tagsMs = Date.now() - tagsStartedAt;
    timings.ollamaConnectMs = timings.tagsMs;
    return healthStatus(isTimeout(error) ? "TAGS_TIMEOUT" : "OLLAMA_OFFLINE", startedAt, { ...phases, tags: isTimeout(error) ? "TIMEOUT" : "FAILED" }, timings, { error: error instanceof Error ? error.message : "Unknown error", retryUsed, coldStart, failedPhase: "tags" });
  }

  const modelStartedAt = Date.now();
  const modelAvailable = Array.isArray(tags.models) && tags.models.some((model) => model.name === config.model || model.name?.startsWith(config.model));
  timings.modelCheckMs = Date.now() - modelStartedAt;
  if (!modelAvailable) return healthStatus("MODEL_NOT_FOUND", startedAt, { ...phases, model: "FAILED" }, timings, { error: `Model ${config.model} not found`, retryUsed, coldStart, failedPhase: "model" });
  phases.model = "OK";

  for (let attempt = 0; attempt < 2; attempt++) {
    const generationStartedAt = Date.now();
    try {
      const response = await fetch(`${config.baseUrl}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model, messages: [{ role: "user", content: "Return only JSON: {\"ok\":true}" }], stream: false, think: false, format: "json", ...(config.keepAlive ? { keep_alive: config.keepAlive } : {}) }),
        signal: AbortSignal.timeout(HEALTH_INFERENCE_TIMEOUT_MS), cache: "no-store",
      });
      timings.generationMs = (timings.generationMs ?? 0) + Date.now() - generationStartedAt;
      if (!response.ok) return healthStatus("GENERATION_FAILED", startedAt, { ...phases, generation: "FAILED" }, timings, { error: `HTTP ${response.status}`, retryUsed, coldStart, failedPhase: "generation" });
      phases.generation = "OK";
      const structuredStartedAt = Date.now();
      let data: OllamaChatResponse;
      try {
        data = await response.json();
        if (parseChatJson(data).ok !== true) throw new Error("Health JSON did not contain ok:true");
      } catch (error: unknown) {
        timings.structuredOutputMs = Date.now() - structuredStartedAt;
        return healthStatus(isTimeout(error) ? "STRUCTURED_OUTPUT_TIMEOUT" : "STRUCTURED_OUTPUT_FAILED", startedAt, { ...phases, structuredOutput: isTimeout(error) ? "TIMEOUT" : "FAILED" }, timings, { error: error instanceof Error ? error.message : "Invalid structured output", retryUsed, coldStart, failedPhase: "structuredOutput" });
      }
      timings.structuredOutputMs = Date.now() - structuredStartedAt;
      const responseWasCold = (data.load_duration ?? 0) > 500_000_000;
      coldStart = retryUsed && !responseWasCold ? null : responseWasCold;
      return healthStatus("READY", startedAt, { ...phases, structuredOutput: "OK" }, timings, { retryUsed, coldStart });
    } catch (error: unknown) {
      timings.generationMs = (timings.generationMs ?? 0) + Date.now() - generationStartedAt;
      if (attempt === 0 && isTimeout(error)) { retryUsed = true; continue; }
      return healthStatus(isTimeout(error) ? "GENERATION_TIMEOUT" : "GENERATION_FAILED", startedAt, { ...phases, generation: isTimeout(error) ? "TIMEOUT" : "FAILED" }, timings, { error: error instanceof Error ? error.message : "Unknown error", retryUsed, coldStart, failedPhase: "generation" });
    }
  }
  return healthStatus("TOTAL_HEALTH_TIMEOUT", startedAt, phases, timings, { error: "Health retry policy exhausted", retryUsed, coldStart, failedPhase: "total" });
}

export async function checkOllamaHealth(config = defaultConfig, options: HealthOptions = {}): Promise<AIHealthStatus> {
  if (!options.forceRefresh && cachedHealth && cachedHealth.expiresAt > Date.now()) return cachedHealth.value;
  if (!options.forceRefresh && inFlightHealth) return inFlightHealth;
  const run = runExclusiveAIJob(() => checkOllamaHealthUncached(config));
  if (!options.forceRefresh) inFlightHealth = run;
  try {
    const result = await run;
    cachedHealth = { value: result, expiresAt: Date.now() + (result.status === "READY" ? HEALTH_CACHE_TTL_MS : FAILED_HEALTH_CACHE_TTL_MS) };
    return result;
  } finally { if (!options.forceRefresh) inFlightHealth = undefined; }
}

export function clearOllamaHealthCache() { cachedHealth = undefined; }

export async function generateStructured<T>(prompt: string, schema: z.ZodSchema<T>, system?: string, config = defaultConfig): Promise<T> {
  if(!externalDataTransferAllowed(config))throw new Error("AI_EXTERNAL_DATA_TRANSFER_DISABLED");
  return runExclusiveAIJob(async () => {
    let attempt = 0;
    while (attempt <= config.maxRetries) {
      try {
        const res = await fetch(`${config.baseUrl}/api/chat`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: config.model, messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }], stream: false, format: "json", think: false, ...(config.keepAlive ? { keep_alive: config.keepAlive } : {}) }),
          signal: AbortSignal.timeout(config.timeoutMs), cache: "no-store",
        });
        if (!res.ok) throw new Error(`Ollama API error: ${res.status}`);
        return schema.parse(parseChatJson(await res.json()));
      } catch (error: unknown) {
        if (attempt === config.maxRetries) throw new Error(`AI structured generation failed after ${config.maxRetries} retries: ${error instanceof Error ? error.message : "Unknown error"}`);
        attempt++;
      }
    }
    throw new Error("Unexpected loop exit");
  });
}

export const aiProviderLimits = { maxConcurrentAIJobs: MAX_CONCURRENT_AI_JOBS, healthCacheTtlMs: HEALTH_CACHE_TTL_MS, healthTagsTimeoutMs: HEALTH_TAGS_TIMEOUT_MS, healthInferenceTimeoutMs: HEALTH_INFERENCE_TIMEOUT_MS };
