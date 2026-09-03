import { describe, expect, it } from "vitest";
import { scoreAnswers } from "./score-lead";
describe("semantic scoring", () => {
  it("não inventa confirmação no simulador", () => {
    expect(
      scoreAnswers({
        valueRange: "Acima de R$ 500 mil",
        debtor: "Estado",
        status: "Sim",
        goal: "Avaliar antecipação",
      }),
    ).toBeLessThan(60);
  });
  it("prioriza pré-análise confirmada e documentada", () => {
    expect(
      scoreAnswers({
        hasPrecat: "Sim, possuo",
        valueRange: "Acima de R$ 500 mil",
        debtor: "Estado",
        processNumber: "Sim, tenho",
        goal: "Avaliar antecipação",
      }),
    ).toBe(100);
  });
});
