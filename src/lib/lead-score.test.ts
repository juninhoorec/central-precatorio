import { describe, expect, it } from "vitest";
import { calculateLeadScore, scoreLabel } from "./lead-score";
describe("lead scoring", () => {
  it("prioriza oportunidade completa com intenção de antecipação", () => {
    const score = calculateLeadScore({
      confirmed: true,
      valueKnown: true,
      targetValue: true,
      processNumber: true,
      anticipationIntent: true,
      whatsapp: true,
      complete: true,
    });
    expect(score).toBe(100);
    expect(scoreLabel(score)).toBe("QUENTE");
  });
  it("mantém contato pouco qualificado como frio", () => {
    const score = calculateLeadScore({ whatsapp: true });
    expect(score).toBe(10);
    expect(scoreLabel(score)).toBe("FRIO");
  });
});
