import { describe, expect, it, vi } from "vitest";
import { buildProviderRequest, generateStructuredWithProvider, resolveAIProvider, type ConfiguredAIProvider } from "./ai-provider";
import { reconfirmationFieldNames, reconfirmationModelOutputSchema } from "../ai-reconfirmation";
import { z } from "zod";

const schema = z.object({ ok: z.boolean() }).strict();

describe("structured AI provider adapters", () => {
  it("builds an OpenAI strict JSON Schema request without embedding credentials", () => {
    const config: ConfiguredAIProvider = {
      provider: "openai", model: "gpt-5-nano", endpoint: "https://api.openai.com/v1/chat/completions",
      timeoutMs: 120_000, maxRetries: 0, structuredOutputMode: "json_schema", apiKey: "test-secret",
    };
    const request = buildProviderRequest(config, "same prompt", "same system", schema);
    expect(request.headers.Authorization).toBe("Bearer test-secret");
    expect(request.body).toMatchObject({
      model: "gpt-5-nano",
      response_format: { type: "json_schema", json_schema: { strict: true, schema: { type: "object", additionalProperties: false } } },
    });
    expect(JSON.stringify(request.body)).not.toMatch(/"(format|pattern|maxLength|minLength|minItems|maxItems)"/);
    expect(JSON.stringify(request.body)).not.toContain("test-secret");
  });

  it("uses DeepSeek JSON mode and validates its response against the same Zod schema", async () => {
    const config: ConfiguredAIProvider = {
      provider: "deepseek", model: "deepseek-flash", endpoint: "https://api.deepseek.com/chat/completions",
      timeoutMs: 120_000, maxRetries: 0, structuredOutputMode: "json_object",
    };
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      expect(input).toBe(config.endpoint);
      expect(init?.method).toBe("POST");
      return Response.json({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }], usage: { prompt_tokens: 12, completion_tokens: 3 } });
    });
    const onMetrics = vi.fn();
    const result = await generateStructuredWithProvider({ config, prompt: "same prompt", system: "same system", schema, fetcher, onMetrics });
    expect(result).toEqual({ ok: true });
    expect(JSON.parse(fetcher.mock.calls[0][1]!.body as string)).toMatchObject({ response_format: { type: "json_object" }, thinking: { type: "disabled" } });
    expect(onMetrics).toHaveBeenCalledWith(expect.objectContaining({ inputTokens: 12, outputTokens: 3, validJson: true, schemaValid: true, retriesUsed: 0 }));
    expect([0.0000036, 0.0000072]).toContain(onMetrics.mock.calls[0][0].estimatedCostUsd);
  });

  it("adds the complete reconfirmation contract and example to DeepSeek only", () => {
    const config: ConfiguredAIProvider = {
      provider: "deepseek", model: "deepseek-flash", endpoint: "https://api.deepseek.com/chat/completions",
      timeoutMs: 120_000, maxRetries: 0, structuredOutputMode: "json_object",
    };
    const request = buildProviderRequest(config, "same prompt", "base system", reconfirmationModelOutputSchema);
    const messages = request.body.messages as { role: string; content: string }[];
    const system = messages.find((message) => message.role === "system")!.content;
    const exampleJson = system.split("Exemplo JSON completo (FORMATO APENAS):\n")[1];
    const example = JSON.parse(exampleJson) as { summary: string; fields: Record<string, unknown>[] };

    expect(request.body.response_format).toEqual({ type: "json_object" });
    expect(system).toContain("Não inclua originalValue");
    expect(system).toContain("somente CONFIRMADO, NÃO_CONFIRMADO, DIVERGENTE ou ATUALIZADO");
    expect(system).toContain("somente UUIDs existentes");
    expect(Object.keys(example)).toEqual(["summary", "fields"]);
    expect(example.fields.map((field) => field.field)).toEqual(reconfirmationFieldNames);
    expect(example.fields).toHaveLength(12);
    for (const field of example.fields) {
      expect(Object.keys(field)).toEqual(["field", "observedValue", "status", "confidence", "evidenceIds", "documentIds", "observation"]);
      expect(field).toMatchObject({ observedValue: null, status: "NÃO_CONFIRMADO", confidence: null, evidenceIds: [], documentIds: [] });
    }

    const genericRequest = buildProviderRequest(config, "same prompt", "base system", schema);
    const genericMessages = genericRequest.body.messages as { role: string; content: string }[];
    expect(genericMessages.find((message) => message.role === "system")!.content).toBe("base system");
  });

  it("keeps paid provider credentials optional for dry-run configuration", () => {
    vi.stubEnv("CP_AI_OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "");
    const config = resolveAIProvider("openai", false);
    expect(config).toMatchObject({ provider: "openai", model: "gpt-5-nano", maxRetries: 0 });
    expect(config).not.toHaveProperty("apiKey");
  });
});