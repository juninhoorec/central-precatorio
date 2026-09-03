export const SCORE_RULES = {
  confirmed: 20,
  valueKnown: 10,
  targetValue: 15,
  processNumber: 15,
  anticipationIntent: 20,
  whatsapp: 10,
  complete: 10,
} as const;
export function calculateLeadScore(
  input: Partial<Record<keyof typeof SCORE_RULES, boolean>>,
) {
  return Math.min(
    100,
    Object.entries(SCORE_RULES).reduce(
      (score, [key, value]) =>
        score + (input[key as keyof typeof SCORE_RULES] ? value : 0),
      0,
    ),
  );
}
export function scoreLabel(score: number) {
  if (score >= 80) return "QUENTE";
  if (score >= 60) return "QUALIFICADO";
  if (score >= 30) return "MORNO";
  return "FRIO";
}
