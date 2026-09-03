import { describe, expect, it } from "vitest";
import { parseBrl } from "./brl";

describe("parseBrl", () => {
  it("aceita valores brasileiros formatados", () => {
    expect(parseBrl("R$ 300.000,00")).toBe(300000);
    expect(parseBrl("300000,50")).toBe(300000.5);
    expect(parseBrl("300.000")).toBe(300000);
  });
  it("aceita entrada simples e rejeita conteúdo inválido", () => {
    expect(parseBrl("300000")).toBe(300000);
    expect(parseBrl("abc")).toBe(0);
  });
});
