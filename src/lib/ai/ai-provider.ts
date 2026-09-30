import { z } from "zod";
import { defaultConfig, generateStructured, type AIProviderConfig } from "./ollama-provider";

export type AIProviderId = "ollama" | "openai" | "deepseek";
export type StructuredOutputMode = "ollama_json" | "json_schema" | "json_object";

export type ConfiguredAIProvider = {
  provider: AIProviderId;
  model: string;
  endpoint: string;
  timeoutMs: number;
  maxRetries: number;
  structuredOutputMode: StructuredOutputMode;
  apiKey?: string;
  ollamaConfig?: AIProviderConfig;
};

export type ProviderRequest = {
  endpoint: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

export type ProviderMetrics = {
  provider: AIProviderId;
  model: string;
  elapsedMs: number;
  retriesUsed: number;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  validJson: boolean;
  schemaValid: boolean;
};

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function resolveAIProvider(provider = process.env.CP_AI_PROVIDER || "ollama", requireApiKey = true): ConfiguredAIProvider {
  if (provider === "ollama") {
    const ollamaConfig = { ...defaultConfig, maxRetries: 0 };
    return {
      provider,
      model: ollamaConfig.model,
      endpoint: `${ollamaConfig.baseUrl}/api/chat`,
      timeoutMs: ollamaConfig.timeoutMs,
      maxRetries: 0,
      structuredOutputMode: "ollama_json",
      ollamaConfig,
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.CP_AI_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    if (requireApiKey && !apiKey) throw new Error("AI_PROVIDER_API_KEY_MISSING:CP_AI_OPENAI_API_KEY");
    return {
      provider,
      model: process.env.CP_AI_OPENAI_MODEL || "gpt-5-nano",
      endpoint: "https://api.openai.com/v1/chat/completions",
      timeoutMs: positiveInteger(process.env.CP_AI_OPENAI_TIMEOUT_MS, 120_000),
      maxRetries: 0,
      structuredOutputMode: "json_schema",
      ...(apiKey ? { apiKey } : {}),
    };
  }

  if (provider === "deepseek") {
    const apiKey = process.env.CP_AI_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
    if (requireApiKey && !apiKey) throw new Error("AI_PROVIDER_API_KEY_MISSING:CP_AI_DEEPSEEK_API_KEY");
    return {
      provider,
      model: process.env.CP_AI_DEEPSEEK_MODEL || "deepseek-flash",
      endpoint: "https://api.deepseek.com/chat/completions",
      timeoutMs: positiveInteger(process.env.CP_AI_DEEPSEEK_TIMEOUT_MS, 120_000),
      maxRetries: 0,
      structuredOutputMode: "json_object",
      ...(apiKey ? { apiKey } : {}),
    };
  }

  throw new Error(`AI_PROVIDER_UNSUPPORTED:${provider}`);
}

function jsonSchemaFor(schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  const unsupportedKeywords = new Set([
    "$schema", "minLength", "maxLength", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum",
    "multipleOf", "minItems", "maxItems", "format", "pattern",
  ]);
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !unsupportedKeywords.has(key))
      .map(([key, child]) => [key, normalize(child)]));
  };
  return normalize(jsonSchema);
}

function deepSeekReconfirmationSystem(system: string, schema: z.ZodType) {
  const jsonSchema = z.toJSONSchema(schema) as { properties?: Record<string, unknown> };
  const fieldsDefinition = jsonSchema.properties?.fields as { items?: { properties?: Record<string, unknown> } } | undefined;
  const fieldDefinition = fieldsDefinition?.items?.properties?.field as { enum?: unknown[] } | undefined;
  const fieldNames = fieldDefinition?.enum;
  if (!Array.isArray(fieldNames) || fieldNames.length !== 12 || !fieldNames.every((field): field is string => typeof field === "string")) return system;

  const example = {
    summary: "FORMATO APENAS: substitua por resumo sustentado pelo pacote.",
    fields: fieldNames.map((field) => ({
      field,
      observedValue: null,
      status: "NÃO_CONFIRMADO",
      confidence: null,
      evidenceIds: [],
      documentIds: [],
      observation: "",
    })),
  };
  const instructions = [
    "Contrato de saída obrigatório para esta reconfirmação; o schema Zod local continua sendo a validação final.",
    "Retorne somente JSON válido, sem Markdown. A raiz deve conter exatamente summary (string não vazia, até 4000 caracteres) e fields (array com exatamente 12 itens).",
    `Cada nome abaixo deve aparecer exatamente uma vez em field: ${fieldNames.join(", ")}. Cada item deve conter exatamente field, observedValue, status, confidence, evidenceIds, documentIds e observation. Não inclua originalValue, propriedades adicionais ou campos extras.`,
    "observedValue aceita string de até 2000 caracteres, número finito, boolean, null ou objeto de contato estrito com exatamente phone (string até 32 caracteres) e email (string até 254 caracteres).",
    "status aceita somente CONFIRMADO, NÃO_CONFIRMADO, DIVERGENTE ou ATUALIZADO. DIVERGENTE e ATUALIZADO exigem evidência explícita vinculada que sustente a diferença; sem esse suporte, use NÃO_CONFIRMADO.",
    "confidence deve ser número de 0 a 100 ou null. evidenceIds e documentIds são arrays obrigatórios contendo somente UUIDs existentes, respectivamente, em officialEvidence e attachedDocuments; sem referências aplicáveis, use []. Nunca invente IDs.",
    "observation deve ser string de até 2000 caracteres. Para NÃO_CONFIRMADO, observedValue e confidence devem ser null, conforme a validação semântica atual do CP; não invente informação.",
    "O exemplo seguinte mostra somente o formato, não dados reais. Não copie seu resumo nem trate seus valores como observações do caso.",
    "Exemplo JSON completo (FORMATO APENAS):",
    JSON.stringify(example, null, 2),
  ].join("\n\n");

  return `${system}\n\n${instructions}`;
}

export function buildProviderRequest(
  config: ConfiguredAIProvider,
  prompt: string,
  system: string,
  schema: z.ZodType,
): ProviderRequest {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

  if (config.provider === "ollama") {
    return {
      endpoint: config.endpoint,
      headers,
      body: {
        model: config.model,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        stream: false,
        format: "json",
        think: false,
        ...(config.ollamaConfig?.keepAlive ? { keep_alive: config.ollamaConfig.keepAlive } : {}),
      },
    };
  }

  if (config.provider === "openai") {
    return {
      endpoint: config.endpoint,
      headers,
      body: {
        model: config.model,
        messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        response_format: {
          type: "json_schema",
          json_schema: { name: "ai_reconfirmation", strict: true, schema: jsonSchemaFor(schema) },
        },
        max_completion_tokens: 4096,
      },
    };
  }

  return {
    endpoint: config.endpoint,
    headers,
    body: {
      model: config.model,
      messages: [{ role: "system", content: deepSeekReconfirmationSystem(system, schema) }, { role: "user", content: prompt }],
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
      reasoning_effort: "none",
      max_tokens: 4096,
    },
  };
}

function contentFromResponse(config: ConfiguredAIProvider, response: Record<string, unknown>) {
  if (config.provider === "ollama") {
    const message = response.message as { content?: unknown } | undefined;
    return typeof message?.content === "string" ? message.content : "";
  }
  const choices = response.choices as { message?: { content?: unknown }; finish_reason?: string }[] | undefined;
  const content = choices?.[0]?.message?.content;
  if (choices?.[0]?.finish_reason === "length") throw new Error("AI_PROVIDER_OUTPUT_TRUNCATED");
  return typeof content === "string" ? content : "";
}

function responseUsage(response: Record<string, unknown>) {
  const usage = response.usage as { prompt_tokens?: unknown; completion_tokens?: unknown } | undefined;
  return {
    inputTokens: typeof usage?.prompt_tokens === "number" ? usage.prompt_tokens : null,
    outputTokens: typeof usage?.completion_tokens === "number" ? usage.completion_tokens : null,
  };
}

export async function generateStructuredWithProvider<T>(input: {
  config: ConfiguredAIProvider;
  prompt: string;
  system: string;
  schema: z.ZodType<T>;
  fetcher?: typeof fetch;
  onMetrics?: (metrics: ProviderMetrics) => void;
}): Promise<T> {
  const { config, prompt, system, schema } = input;
  if (config.provider === "ollama") {
    if (!config.ollamaConfig) throw new Error("OLLAMA_PROVIDER_CONFIGURATION_MISSING");
    return generateStructured(prompt, schema, system, config.ollamaConfig);
  }

  const fetcher = input.fetcher || fetch;
  const request = buildProviderRequest(config, prompt, system, schema);
  const startedAt = Date.now();
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let validJson = false;
  let schemaValid = false;
  let estimatedCostUsd: number | null = null;
  let retriesUsed = 0;
  try {
    let attempt = 0;
    while (attempt <= config.maxRetries) {
      try {
        const response = await fetcher(request.endpoint, {
          method: "POST",
          headers: request.headers,
          body: JSON.stringify(request.body),
          signal: AbortSignal.timeout(config.timeoutMs),
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`AI_PROVIDER_HTTP_${response.status}`);
        const data = await response.json() as Record<string, unknown>;
        ({ inputTokens, outputTokens } = responseUsage(data));
        estimatedCostUsd = estimatedCost(config, inputTokens, outputTokens);
        const content = contentFromResponse(config, data);
        if (!content) throw new Error("AI_PROVIDER_EMPTY_RESPONSE");
        let parsed: unknown;
        try {
          parsed = JSON.parse(content);
          validJson = true;
        } catch {
          throw new Error("AI_PROVIDER_INVALID_JSON");
        }
        const result = schema.safeParse(parsed);
        if (!result.success) throw new Error("AI_PROVIDER_SCHEMA_INVALID");
        schemaValid = true;
        return result.data;
      } catch (error) {
        if (attempt >= config.maxRetries) throw error;
        attempt++;
        retriesUsed++;
      }
    }
    throw new Error("AI_PROVIDER_RETRY_POLICY_EXHAUSTED");
  } finally {
    input.onMetrics?.({
      provider: config.provider,
      model: config.model,
      elapsedMs: Date.now() - startedAt,
      retriesUsed,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      validJson,
      schemaValid,
    });
  }
}

export function estimateTokensFromBytes(bytes: number) {
  return Math.ceil(bytes / 4);
}

function estimatedCost(config: ConfiguredAIProvider, inputTokens: number | null, outputTokens: number | null) {
  if (inputTokens === null || outputTokens === null) return null;
  if (config.provider === "openai") return (inputTokens * 0.05 + outputTokens * 0.4) / 1_000_000;
  if (config.provider === "deepseek") {
    const now = new Date();
    const day = now.getUTCDay();
    const hour = now.getUTCHours();
    const peak = day >= 1 && day <= 5 && ((hour >= 1 && hour < 4) || (hour >= 6 && hour < 10));
    const inputRate = peak ? 0.3 : 0.15;
    const outputRate = peak ? 1.2 : 0.6;
    return (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  }
  return null;
}