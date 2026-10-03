import { describe, expect, it } from "vitest";
import { assessDepreEnrichment } from "./depre-enrichment";

describe("DEPRE enrichment", () => {
  it("keeps multiple historical titulars unresolved", () => {
    const result = assessDepreEnrichment({ depre: "0038850-88.2017.8.26.0500", titularCandidates: ["Lúcia", "Nelson"], titularLinkedByOfficialDocument: true, originProcess: null, seiProcess: "PMC.2021.00051374-90", lawyer: "Daniel", oab: null, value: null, valueStatus: "UNKNOWN", dataBase: null, contactStatus: "NO_CONFIRMED_CONTACT" });
    expect(result.titularStatus).toBe("NÃO_CONFIRMADO");
    expect(result.seiStatus).toBe("LOCALIZADO");
    expect(result.warnings).toContain("MULTIPLE_HISTORICAL_TITULAR_CANDIDATES");
    expect(result.warnings).toContain("LAWYER_LOCATED_OAB_NOT_LOCATED");
  });
  it("does not treat historical value as current", () => {
    const result = assessDepreEnrichment({ depre: "0513642-74.2019.8.26.0500", titularCandidates: ["Sandra"], titularLinkedByOfficialDocument: true, originProcess: null, seiProcess: "PMC.2021.00049793-06", lawyer: "Eneida", oab: null, value: 100, valueStatus: "HISTORICAL", dataBase: "2021-09-27", contactStatus: "PROFESSIONAL_ROUTE" });
    expect(result.titularStatus).toBe("CONFIRMED");
    expect(result.valueStatusLabel).toBe("LOCALIZADO");
    expect(result.warnings).toContain("HISTORICAL_VALUE_NOT_CURRENT");
    expect(result.contactRouteStatus).toBe("LOCALIZADO");
  });
});
