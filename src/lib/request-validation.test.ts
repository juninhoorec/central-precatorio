import { describe, expect, it } from "vitest";
import { readJsonBody } from "./request-validation";

describe("bounded JSON request parsing", () => {
  it("parses a body below the limit", async () => {
    const result = await readJsonBody(new Request("https://cp.test", { method: "POST", body: JSON.stringify({ status: "OPEN" }) }), 100);
    expect(result).toEqual({ ok: true, value: { status: "OPEN" } });
  });

  it("rejects declared and streamed bodies above the limit", async () => {
    const declared = await readJsonBody(new Request("https://cp.test", { method: "POST", headers: { "content-length": "1000" }, body: "{}" }), 100);
    const streamed = await readJsonBody(new Request("https://cp.test", { method: "POST", body: "x".repeat(200) }), 100);
    expect(declared).toEqual({ ok: false, reason: "too_large" });
    expect(streamed).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects malformed JSON", async () => {
    expect(await readJsonBody(new Request("https://cp.test", { method: "POST", body: "{" }), 100))
      .toEqual({ ok: false, reason: "invalid_json" });
  });
});
