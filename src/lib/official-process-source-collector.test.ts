import { describe, expect, it, vi } from "vitest";
import { createResearchOfficialProcessRoutes, OfficialProcessSourceCollector } from "./official-process-source-collector";
import type { OfficialProcessRoute } from "./datajud-tjsp-experimental";

const query = { processNumber: "0196151-64.2018.8.26.0500" };

function result(source: OfficialProcessRoute["source"], status: string, ok = false) {
  return { source, status, ok, requestAttempted: false, httpStatus: null, durationMs: 0, query };
}

describe("OfficialProcessSourceCollector", () => {
  it("starts all applicable provider routes concurrently", async () => {
    const started: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
    const routes: OfficialProcessRoute[] = [
      { source: "DATAJUD_TJSP", supports: () => true, search: async () => { started.push("datajud"); await firstGate; return result("DATAJUD_TJSP", "NO_RESULTS", true); } },
      { source: "DJEN", supports: () => true, search: async () => { started.push("djen"); return result("DJEN", "NO_RESULT", true); } },
    ];
    const pending = new OfficialProcessSourceCollector(routes).search(query);
    const bothStartedBeforeCompletion = started.length === 2;
    releaseFirst();
    const results = await pending;

    expect(bothStartedBeforeCompletion).toBe(true);
    expect(results.map(item => item.source)).toEqual(["DATAJUD_TJSP", "DJEN"]);
  });

  it("preserves zero results and source failures while returning every route", async () => {
    const order: string[] = [];
    const routes: OfficialProcessRoute[] = [
      { source: "DATAJUD_TJSP", supports: () => true, search: async () => { order.push("datajud"); return result("DATAJUD_TJSP", "NO_RESULTS", true); } },
      { source: "DJEN", supports: () => true, search: async () => { order.push("djen"); throw new Error("fixture source failure"); } },
      { source: "TJSP_ESAJ", supports: () => true, search: async () => { order.push("esaj"); return result("TJSP_ESAJ", "MANUAL_REQUIRED"); } },
    ];
    const results = await new OfficialProcessSourceCollector(routes).search(query);

    expect(order).toEqual(["datajud", "djen", "esaj"]);
    expect(results.map(item => item.status)).toEqual(["NO_RESULTS", "UNAVAILABLE", "MANUAL_REQUIRED"]);
    expect(results[1].error?.code).toBe("ROUTE_ERROR");
  });

  it("prioritizes direct TJSP before DataJud and ComunicaCNJ in the research matrix", async () => {
    const order = createResearchOfficialProcessRoutes().map(route => route.source);
    expect(order.slice(0, 3)).toEqual(["TJSP_DIRECT", "DATAJUD_TJSP", "DJEN"]);
  });

  it("marks non-applicable routes and continues to applicable routes", async () => {
    const lookup = vi.fn(async () => result("DJEN", "NO_RESULTS", true));
    const routes: OfficialProcessRoute[] = [
      { source: "DATAJUD_TJSP", supports: request => Boolean(request.partyName), search: async () => result("DATAJUD_TJSP", "FOUND", true) },
      { source: "DJEN", supports: request => Boolean(request.processNumber), search: lookup },
    ];
    const results = await new OfficialProcessSourceCollector(routes).search(query);
    expect(results.map(item => item.status)).toEqual(["NOT_APPLICABLE", "NO_RESULTS"]);
    expect(results[0].requestAttempted).toBe(false);
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});