import { describe, expect, it } from "vitest";
import { adaptCacResult, adaptDjenResult, adaptEsajResult } from "./source-adapters";

describe("source adapters", () => {
  it("canonicalizes DJEN success without manufacturing documents", () => { const result = adaptDjenResult({ provider: "DJEN", route: "communication-search", requestedIdentifier: "D-1", status: "SUCCESS", requestAttempted: true, httpStatus: 200 }); expect(result.sourceId).toBe("djen"); expect(result.documentaryCandidates).toEqual([]); expect(result.canonicalResult?.status).toBe("SUCCESS"); });
  it("preserves e-SAJ CAPTCHA and CAC manual-required outcomes", () => { expect(adaptEsajResult({ provider: "TJSP", route: "esaj", requestedIdentifier: "D-1", status: "CAPTCHA_REQUIRED", requestAttempted: true, httpStatus: 403 }).status).toBe("CAPTCHA_REQUIRED"); expect(adaptCacResult({ provider: "TJSP", route: "cac", requestedIdentifier: "D-1", status: "MANUAL_REQUIRED", requestAttempted: false }).status).toBe("MANUAL_REQUIRED"); });
});
