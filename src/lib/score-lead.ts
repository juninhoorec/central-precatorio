import { calculateLeadScore } from "./lead-score";
export function scoreAnswers(answers: Record<string, string>) {
  return calculateLeadScore({
    confirmed: answers.hasPrecat === "Sim, possuo",
    valueKnown: Boolean(
      answers.valueRange && !answers.valueRange.includes("Não"),
    ),
    targetValue: answers.valueRange?.includes("500 mil"),
    processNumber: answers.processNumber === "Sim, tenho",
    anticipationIntent: answers.goal?.includes("antecipação"),
    whatsapp: true,
    complete: ["hasPrecat", "valueRange", "debtor", "goal"].every((key) =>
      Boolean(answers[key]),
    ),
  });
}
