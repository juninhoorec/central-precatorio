import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkOllamaHealth, clearOllamaHealthCache, generateStructured, defaultConfig, aiProviderLimits } from "./ollama-provider";
import { z } from "zod";

const mockFetch = vi.fn();
global.fetch = mockFetch;
const config = { ...defaultConfig, model: "qwen3:4b", maxRetries: 1 };
const tags = { ok: true, json: async () => ({ models: [{ name: "qwen3:4b" }] }) };
const readyChat = { ok: true, json: async () => ({ message: { content: "{\"ok\":true}" }, load_duration: 0 }) };

beforeEach(() => { mockFetch.mockReset(); clearOllamaHealthCache(); });

describe("Ollama health check", () => {
  it("allows the measured cold-start latency within the inference budget", () => {
    expect(aiProviderLimits.healthInferenceTimeoutMs).toBe(90_000);
  });

  it("does not contact a non-local AI endpoint without explicit external-data consent", async () => {
    const remote = { ...config, baseUrl: "https://ai.example.test" };
    const health = await checkOllamaHealth(remote, { forceRefresh: true });
    expect(health.status).toBe("EXTERNAL_DATA_TRANSFER_DISABLED");
    await expect(generateStructured("external document content", z.object({ ok: z.boolean() }), "", remote))
      .rejects.toThrow("AI_EXTERNAL_DATA_TRANSFER_DISABLED");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("reports a tags timeout by phase", async () => {
    mockFetch.mockRejectedValueOnce(Object.assign(new Error("timed out"), { name: "TimeoutError" }));
    const health = await checkOllamaHealth(config, { forceRefresh: true });
    expect(health.status).toBe("TAGS_TIMEOUT");
    expect(health.failedPhase).toBe("tags");
    expect(health.phases.tags).toBe("TIMEOUT");
  });

  it("reports a missing requested model", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ models: [{ name: "other-model" }] }) });
    const health = await checkOllamaHealth(config, { forceRefresh: true });
    expect(health.status).toBe("MODEL_NOT_FOUND");
    expect(health.phases.model).toBe("FAILED");
  });

  it("uses the verified chat request and reports structured failures", async () => {
    mockFetch.mockResolvedValueOnce(tags).mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: "not json" } }) });
    const health = await checkOllamaHealth(config, { forceRefresh: true });
    expect(health.status).toBe("STRUCTURED_OUTPUT_FAILED");
    expect(mockFetch.mock.calls[1][0]).toContain("/api/chat");
    expect(JSON.parse(mockFetch.mock.calls[1][1].body)).toMatchObject({ model: "qwen3:4b", stream: false, think: false, format: "json" });
  });

  it("uses one bounded retry for a transient generation timeout", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    mockFetch.mockResolvedValueOnce(tags).mockRejectedValueOnce(timeout).mockResolvedValueOnce(readyChat);
    const health = await checkOllamaHealth(config, { forceRefresh: true });
    expect(health.status).toBe("READY");
    expect(health.retryUsed).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("does not retry more than once when generation keeps timing out", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    mockFetch.mockResolvedValueOnce(tags).mockRejectedValueOnce(timeout).mockRejectedValueOnce(timeout);
    const health = await checkOllamaHealth(config, { forceRefresh: true });
    expect(health.status).toBe("GENERATION_TIMEOUT");
    expect(health.retryUsed).toBe(true);
    expect(health.coldStart).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("reports a structured-output timeout separately from generation", async () => {
    const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    mockFetch.mockResolvedValueOnce(tags).mockResolvedValueOnce({ ok: true, json: async () => { throw timeout; } });
    const health = await checkOllamaHealth(config, { forceRefresh: true });

    expect(health.status).toBe("STRUCTURED_OUTPUT_TIMEOUT");
    expect(health.failedPhase).toBe("structuredOutput");
    expect(health.phases.generation).toBe("OK");
    expect(health.phases.structuredOutput).toBe("TIMEOUT");
    expect(health.retryUsed).toBe(false);
  });

  it("marks a slow model load as a cold start when the response succeeds", async () => {
    mockFetch.mockResolvedValueOnce(tags).mockResolvedValueOnce({ ok: true, json: async () => ({ message: { content: "{\"ok\":true}" }, load_duration: 700_000_000 }) });
    const health = await checkOllamaHealth(config, { forceRefresh: true });

    expect(health.status).toBe("READY");
    expect(health.coldStart).toBe(true);
  });

  it("caches a ready result briefly and shares concurrent health calls", async () => {
    mockFetch.mockResolvedValueOnce(tags).mockResolvedValueOnce(readyChat);
    const [first, second] = await Promise.all([checkOllamaHealth(config), checkOllamaHealth(config)]);
    const third = await checkOllamaHealth(config);
    expect(first.status).toBe("READY");
    expect(second.status).toBe("READY");
    expect(third.status).toBe("READY");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("Structured generation", () => {
  it("uses a 120 second timeout for structured generation requests", () => {
    expect(defaultConfig.timeoutMs).toBe(120_000);
  });

  it("serially retries invalid schemas and keeps the validated chat settings", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ message: { content: "{\"wrongField\":true}" } }) });
    await expect(generateStructured("test", z.object({ ok: z.boolean() }), "", config)).rejects.toThrow(/AI structured generation failed/);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toMatchObject({ stream: false, think: false, format: "json" });
  });
});
