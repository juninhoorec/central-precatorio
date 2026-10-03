import { describe, expect, it } from "vitest";
import { TjspCacRecordParser, type CacTextItem } from "./tjsp-cac-record-parser";

const documentId = "cac-real-doc-1";
const depre = "1234567-12.2024.8.26.0001";
const origin = "7654321-12.2020.8.26.0001";
const autos = "8765432-34.2019.8.26.0002";

function recordRows(order: number, yStart = 800, options: { epes?: string; debtor?: string; attorneys?: string[]; optional?: boolean } = {}) {
  const rows: CacTextItem[] = [
    { text: origin, x: 75, y: yStart + 24 },
    { text: "ALIMENTARES", x: 75, y: yStart + 12 },
    { text: `Ordem de Pagamento: ${order} Nº Processo DEPRE: ${depre}`, x: 75, y: yStart },
    { text: "Natureza: ALIMENTAR", x: 75, y: yStart - 12 },
    { text: `Nº de autos: ${autos} Ordem Orçamentária: 2025`, x: 75, y: yStart - 24 },
  ];
  if (options.epes) rows.push({ text: `ES/EP: ${options.epes}`, x: 75, y: yStart - 36 });
  rows.push({ text: "Valor atualizado: R$ 200.000,00", x: 75, y: yStart - 48 });
  rows.push({ text: "Data: 01/09/2026 Nº do Protocolo Geral: 12345", x: 75, y: yStart - 60 });
  for (const [index, attorney] of (options.attorneys ?? ["Dr. Nome Exemplo"]).entries()) {
    rows.push({ text: index === 0 ? `Advogado(s): ${attorney}` : attorney, x: 75, y: yStart - 72 - index * 12 });
  }
  if (options.debtor !== "") rows.push({ text: `Devedora: ${options.debtor ?? "MUNICIPIO EXEMPLO"}`, x: 75, y: yStart - 110 });
  return rows;
}

function parser(options: ConstructorParameters<typeof TjspCacRecordParser>[0] = {}) {
  return new TjspCacRecordParser({ documentId, archiveEntry: "cac.pdf", ...options });
}

describe("stateful real-layout CAC parser", () => {
  it("accepts a normal record and keeps distinct process fields with page evidence", () => {
    const instance = parser();
    instance.pushPage(1, recordRows(1, 800, { epes: "5910/2014" }));
    const result = instance.finish();

    expect(result.stats).toMatchObject({ candidateStarts: 1, acceptedRecords: 1, rejectedCandidates: 0 });
    expect(result.records[0]).toMatchObject({
      documentId,
      paymentOrder: "1",
      numeroProcessoDEPRE: depre,
      numeroAutos: autos,
      numeroProcessoOriginario: origin,
      numeroEPES: "5910/2014",
      epesNumber: "5910",
      epesYear: "2014",
      amount: 200000,
      debtorSource: "RECORD",
      startPage: 1,
      endPage: 1,
    });
    expect(result.records[0].fieldEvidence.some(evidence => evidence.field === "numeroProcessoDEPRE" && evidence.page === 1 && evidence.textSpan.includes(depre))).toBe(true);
  });

  it("uses the CNJ and nature prelude as stronger context, not payment text alone", () => {
    const instance = parser();
    instance.pushPage(1, recordRows(1, 800));
    const result = instance.finish();

    expect(result.records).toHaveLength(1);
    expect(result.records[0].startPage).toBe(1);
    expect(result.records[0].numeroProcessoOriginario).toBe(origin);
    expect(result.records[0].numeroAutos).toBe(autos);
  });

  it("parses multiple payment blocks on one page", () => {
    const instance = parser();
    instance.pushPage(1, [...recordRows(1, 800), ...recordRows(2, 650)]);
    const result = instance.finish();

    expect(result.records).toHaveLength(2);
    expect(result.records.map(record => record.paymentOrder)).toEqual(["1", "2"]);
    expect(result.stats.candidateStarts).toBe(2);
  });

  it("preserves parser state and evidence across a page boundary", () => {
    const instance = parser();
    instance.pushPage(10, recordRows(1, 100, { debtor: "" }).slice(0, 5));
    instance.pushPage(11, [
      { text: "Advogado(s): Dr. Segundo Nome", x: 75, y: 830 },
      { text: "Devedora: MUNICIPIO EXEMPLO", x: 75, y: 818 },
    ]);
    const result = instance.finish();

    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({ startPage: 10, endPage: 11, page: 10 });
    expect(result.records[0].fieldEvidence.some(evidence => evidence.page === 11 && evidence.field === "debtor")).toBe(true);
    expect(result.stats.spanningRecords).toBe(1);
  });

  it("preserves multiline attorney entries without promoting them to creditor", () => {
    const instance = parser();
    instance.pushPage(1, recordRows(1, 800, { attorneys: ["Dra. Primeira", "Dr. Segundo"] }));
    const result = instance.finish();

    expect(result.records[0].attorneys).toEqual(["Dra. Primeira", "Dr. Segundo"]);
    expect(result.records[0].creditor).toBe("");
  });

  it("accepts records when optional ES/EP is present or absent", () => {
    const withEpes = parser();
    withEpes.pushPage(1, recordRows(1, 800, { epes: "5910/2014" }));
    const withoutEpes = parser();
    withoutEpes.pushPage(1, recordRows(1, 800));

    expect(withEpes.finish().records[0].numeroEPES).toBe("5910/2014");
    const missing = withoutEpes.finish().records[0];
    expect(missing.numeroEPES).toBe("");
    expect(missing.missingOptionalFields).toContain("epes");
  });

  it("preserves negative amounts and their exact source evidence", () => {
    const instance = parser();
    instance.pushPage(1, recordRows(1, 800).map(item => item.text.startsWith("Valor atualizado:") ? { ...item, text: "Valor atualizado: -R$ 200.000,00" } : item));
    const record = instance.finish().records[0];
    const evidence = record.fieldEvidence.find(item => item.field === "amount");

    expect(record.amount).toBe(-200000);
    expect(evidence?.textSpan).toBe("Valor atualizado: -R$ 200.000,00");
    expect(record.rawText).toContain(evidence?.textSpan);
  });

  it("records debtor inherited from the report header with explicit provenance", () => {
    const instance = parser({ reportHeaderDebtor: { value: "ENTE PUBLICO EXEMPLO", page: 1, textSpan: "header report debtor" } });
    instance.pushPage(1, recordRows(1, 800, { debtor: "" }));
    const result = instance.finish();

    expect(result.records[0]).toMatchObject({ debtor: "ENTE PUBLICO EXEMPLO", debtorSource: "REPORT_HEADER" });
    expect(result.records[0].fieldEvidence).toContainEqual(expect.objectContaining({ field: "devedora", page: 1, source: "REPORT_HEADER" }));
  });

  it("rejects a candidate with an invalid DEPRE identifier and preserves the reason", () => {
    const instance = parser();
    instance.pushPage(1, [
      { text: "Ordem de Pagamento: 1 Nº Processo DEPRE: inválido", x: 75, y: 800 },
      { text: "Natureza: ALIMENTAR", x: 75, y: 788 },
      { text: "Nº de autos: 7654321-12.2020.8.26.0001", x: 75, y: 776 },
      { text: "Devedora: MUNICIPIO EXEMPLO", x: 75, y: 764 },
    ]);
    const result = instance.finish();

    expect(result.records).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0].reason).toBe("INVALID_DEPRE_FORMAT");
  });

  it("classifies a nested marker before debtor completion", () => {
    const instance = parser();
    instance.pushPage(1, [
      ...recordRows(1, 800, { debtor: "" }),
      ...recordRows(2, 600),
    ]);
    const result = instance.finish();

    expect(result.stats.candidateStarts).toBe(2);
    expect(result.rejected.some(candidate => candidate.reason === "NESTED_RECORD")).toBe(true);
    expect(result.records).toHaveLength(1);
  });

  it("classifies an unfinished final candidate at end of document", () => {
    const instance = parser();
    instance.pushPage(1, recordRows(1, 800, { debtor: "" }).slice(0, 6));
    const result = instance.finish();

    expect(result.records).toEqual([]);
    expect(result.rejected.map(candidate => candidate.reason)).toEqual(["TRUNCATED_RECORD"]);
  });
});
