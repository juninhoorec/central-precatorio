import { describe, expect, it } from "vitest";
import { evaluateCommercialMinimum, type CommercialMinimumDocument } from "./commercial-qualification";

const base = { operationId: "op", depre: "0000001-00.2024.8.26.0114", creditorName: "Titular Fixture", creditorVerified: true, identityConflict: false, amount: 100000, amountSource: "https://www.campinas.sp.gov.br/oficial", debtor: "Município de Campinas" };
const docs = (same = false): CommercialMinimumDocument[] => [
  { id: "1", operationId: "op", depre: base.depre, creditorName: base.creditorName, sourceUrl: "https://www.campinas.sp.gov.br/oficio/1", title: "Ofício requisitório 1", documentIdentifier: "OF-1", status: "VERIFIED", evidenceStrength: "STRONG", linkAccessible: true, contentFingerprint: "doc-1" },
  { id: "2", operationId: "op", depre: base.depre, creditorName: base.creditorName, sourceUrl: same ? "https://www.campinas.sp.gov.br/oficio/1" : "https://www.campinas.sp.gov.br/oficio/2", title: same ? "Cópia do ofício 1" : "Ofício requisitório 2", documentIdentifier: same ? "OF-1" : "OF-2", status: "VERIFIED", evidenceStrength: "STRONG", linkAccessible: true, contentFingerprint: same ? "doc-1" : "doc-2" },
];
type Overrides = { operationId?: string; depre?: string; creditorName?: string; creditorVerified?: boolean; identityConflict?: boolean; amount?: number | null; amountSource?: string; amountIsEstimate?: boolean; debtor?: string; sourceBlocked?: boolean };
const evaluate = (overrides: Overrides = {}, documents = docs()) => evaluateCommercialMinimum({ ...base, ...overrides, documents });

describe("commercial minimum qualification", () => {
  it("approves the four minimum requirements", () => expect(evaluate().approved).toBe(true));
  it("accepts exactly R$100,000", () => expect(evaluate({ amount: 100000 }).approved).toBe(true));
  it("rejects missing, estimated, and below-minimum values", () => {
    expect(evaluate({ amount: 99999 }).approved).toBe(false);
    expect(evaluate({ amount: null }).approved).toBe(false);
    expect(evaluate({ amountIsEstimate: true }).approved).toBe(false);
  });
  it("requires verified identity and rejects conflicts", () => {
    expect(evaluate({ creditorVerified: false }).state).toBe("PENDENTE_TITULAR");
    expect(evaluate({ identityConflict: true }).state).toBe("REVISAO_MANUAL");
  });
  it("accepts only the three municipal debtors and rejects Fazenda/SPPREV", () => {
    expect(evaluate({ debtor: "Município de Guarulhos" }).approved).toBe(true);
    expect(evaluate({ debtor: "Município de São Paulo" }).approved).toBe(true);
    expect(evaluate({ debtor: "Fazenda do Estado de São Paulo" }).state).toBe("MUNICIPIO_FORA_ESCOPO");
  });
  it("requires two distinct linked official documents with accessible links", () => {
    expect(evaluate({}, docs().slice(0, 1)).approved).toBe(false);
    expect(evaluate({}, docs(true)).approved).toBe(false);
    expect(evaluate({}, docs().map((doc) => ({ ...doc, linkAccessible: false }))).approved).toBe(false);
    expect(evaluate({}, docs().map((doc) => ({ ...doc, creditorName: "Outro titular" }))).approved).toBe(false);
  });
  it("does not require contact, lawyer, or OAB", () => expect(evaluate().approved).toBe(true));
  it("distinguishes a blocked source from a successful no-result", () => {
    const result = evaluate({ sourceBlocked: true }, []);
    expect(result.approved).toBe(false);
    expect(result.state).toBe("FONTE_BLOQUEADA");
  });
});
