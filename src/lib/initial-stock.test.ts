import { describe, expect, it } from "vitest";
import { INITIAL_DEPRE_SOURCE, isInitialDepreStock } from "./initial-stock";

describe("estoque inicial de DEPREs", () => {
  it("reconhece registros legados pela origem persistida", () => {
    expect(isInitialDepreStock({ source: INITIAL_DEPRE_SOURCE, workflow: null })).toBe(true);
  });

  it("mantém compatibilidade com o marcador de inventário", () => {
    expect(isInitialDepreStock({ source: "", workflow: { inventory: { origin: "INITIAL_73" } } })).toBe(true);
  });

  it("não inclui E2E, teste, sintético ou sem origem", () => {
    for (const source of ["E2E", "teste automatizado", "DADOS SINTÉTICOS CP", "", null]) {
      expect(isInitialDepreStock({ source, workflow: null })).toBe(false);
    }
  });
});
