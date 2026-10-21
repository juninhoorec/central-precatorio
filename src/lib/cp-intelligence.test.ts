import { describe, expect, it } from "vitest";
import { dataQuality, nextBestAction, priorityScore, slaState } from "./cp-intelligence";

describe("CP intelligence", () => {
  it("routes incomplete records to the most useful next action", () => {
    expect(nextBestAction({ titular: "", valor: 200000 })).toBe("CONFIRMAR_CREDOR");
    expect(nextBestAction({ titular: "Maria", valor: 200000 })).toBe("CONFERIR_CPF");
    expect(nextBestAction({ titular: "Maria", cpfCnpj: "123.456.789-01", valor: 200000, oficio1Url: "url" })).toBe("LOCALIZAR_ADVOGADO");
  });
  it("scores document-backed records above incomplete records", () => {
    expect(priorityScore({ titular: "Maria", cpfCnpj: "12345678901", valor: 600000, advogadoNome: "Dr. X", oficio1Url: "url", natureza: "Alimentar" })).toBeGreaterThan(priorityScore({ titular: "Credor Titular DEPRE x", valor: 600000 }));
  });
  it("exposes quality and SLA thresholds", () => {
    expect(dataQuality({ titular: "Maria", cpfCnpj: "12345678901", valor: 100000 }).percent).toBeGreaterThan(0);
    expect(slaState(new Date(Date.now() - 8 * 24 * 3600000).toISOString()).level).toBe("CRITICO");
  });
});
