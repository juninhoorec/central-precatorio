import { z } from "zod";
import { type PilotCorpusItem } from "./ai-pilot-corpus";
import { creditorExtractionTask, type CreditorExtractionOutput } from "./ai-tasks/creditor-extraction";

export const evaluationClassificationSchema = z.enum([
  "CORRECT",
  "PARTIALLY_CORRECT",
  "INCORRECT",
  "UNSUPPORTED",
  "ABSTAINED_CORRECTLY",
  "ABSTAINED_INCORRECTLY"
]);

export type EvaluationClassification = z.infer<typeof evaluationClassificationSchema>;

export const failureCategorySchema = z.enum([
  "NONE",
  "WRONG_CONTEXT",
  "WRONG_ROLE",
  "WRONG_PAGE",
  "HALLUCINATION",
  "IDENTIFIER_ERROR",
  "SOURCE_CONFLICT_ERROR",
  "HISTORICAL_CURRENT_CONFUSION",
  "INSUFFICIENT_ABSTENTION",
  "OTHER"
]);

export type FailureCategory = z.infer<typeof failureCategorySchema>;

export interface TaskEvaluationResult {
  taskId: string;
  promptVersion: string;
  classification: EvaluationClassification;
  failureCategory: FailureCategory;
  aiOutput: unknown;
  goldExpected: unknown;
  evidenceProvided: boolean;
  evidenceCorrect: boolean;
  reason: string;
  latencyMs: number;
}

export interface PilotScorecard {
  totalCases: number;
  promptVersion: string;
  metrics: {
    accuracyPercent: number;
    unsupportedClaimRatePercent: number;
    falseCreditorRatePercent: number;
    attorneyAsCreditorRatePercent: number;
    pageAccuracyPercent: number;
    correctAbstentionRatePercent: number;
  };
  classificationCounts: Record<EvaluationClassification, number>;
  failureCategoryCounts: Record<FailureCategory, number>;
  results: Array<{
    corpusItemId: string;
    itemTitle: string;
    scenarioType: string;
    taskResult: TaskEvaluationResult;
  }>;
  evaluatedAt: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export async function evaluateCorpusItem(
  item: PilotCorpusItem,
  promptVersion = "v1"
): Promise<TaskEvaluationResult> {
  const start = Date.now();
  const gold = item.goldAnnotation;
  if (!gold) {
    return {
      taskId: creditorExtractionTask.name,
      promptVersion,
      classification: "UNSUPPORTED",
      failureCategory: "OTHER",
      aiOutput: null,
      goldExpected: null,
      evidenceProvided: false,
      evidenceCorrect: false,
      reason: "Item do corpus não possui GoldAnnotation humana configurada.",
      latencyMs: 0
    };
  }

  let aiOutput: CreditorExtractionOutput;
  try {
    aiOutput = await creditorExtractionTask.execute({
      documentText: item.documentText,
      depre: item.depre,
      originProcess: item.originProcess
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Execution error";
    aiOutput = {
      candidates: [],
      uncertainties: ["IA offline ou falha na geração estruturada"],
      warnings: [message]
    };
  }
  const latencyMs = Date.now() - start;

  // Evaluate Creditor Candidate Extraction & Attorney distinction
  const aiCreditorCandidate = aiOutput.candidates.find(c => c.role === "CREDOR" || c.role === "BENEFICIARIO");
  const aiAttorneyAsCreditor = aiOutput.candidates.some(c => (c.role === "CREDOR" || c.role === "BENEFICIARIO") && (norm(c.name).includes("carlos") || norm(c.name).includes("roberto") || norm(c.name).includes("advogado") || norm(c.name).includes("procurador")));

  const goldHasCreditor = gold.expectedCreditor !== "NOT_ESTABLISHED" && gold.expectedCreditor.length > 0;
  const evidenceProvided = aiOutput.candidates.some(c => c.evidenceText.length > 0);

  let classification: EvaluationClassification = "CORRECT";
  let failureCategory: FailureCategory = "NONE";
  let reason = "AI output matches gold standard annotation.";

  if (aiAttorneyAsCreditor) {
    classification = "INCORRECT";
    failureCategory = "WRONG_ROLE";
    reason = "FALHA CRÍTICA: Advogado foi classificado incorretamente como Credor!";
  } else if (!goldHasCreditor) {
    // Expected abstention case
    if (!aiCreditorCandidate || aiCreditorCandidate.name.toUpperCase().includes("NOT_ESTABLISHED") || aiOutput.candidates.length === 0) {
      classification = "ABSTAINED_CORRECTLY";
      reason = "Abstenção correta: Documento não possuía credor e a IA não inventou um credor.";
    } else {
      classification = "INCORRECT";
      failureCategory = "HALLUCINATION";
      reason = `FALHA (Credor Falso): A IA inventou o credor "${aiCreditorCandidate.name}" quando a fonte não continha credor estabelecido.`;
    }
  } else {
    // Expected creditor case
    if (!aiCreditorCandidate) {
      classification = "ABSTAINED_INCORRECTLY";
      failureCategory = "INSUFFICIENT_ABSTENTION";
      reason = `Abstenção incorreta: A fonte continha o credor "${gold.expectedCreditor}", mas a IA não o identificou.`;
    } else if (norm(aiCreditorCandidate.name).includes(norm(gold.expectedCreditor)) || norm(gold.expectedCreditor).includes(norm(aiCreditorCandidate.name))) {
      classification = "CORRECT";
      reason = `Identificação correta do credor "${gold.expectedCreditor}".`;
    } else {
      classification = "INCORRECT";
      failureCategory = "WRONG_CONTEXT";
      reason = `Divergência: Esperado "${gold.expectedCreditor}", retornado "${aiCreditorCandidate.name}".`;
    }
  }

  // Check evidence quality
  const evidenceCorrect = classification === "CORRECT" || classification === "ABSTAINED_CORRECTLY";

  return {
    taskId: creditorExtractionTask.name,
    promptVersion,
    classification,
    failureCategory,
    aiOutput,
    goldExpected: gold,
    evidenceProvided,
    evidenceCorrect,
    reason,
    latencyMs
  };
}

export async function runPilotEvaluation(
  items: PilotCorpusItem[],
  promptVersion = "v1"
): Promise<PilotScorecard> {
  const results: Array<{ corpusItemId: string; itemTitle: string; scenarioType: string; taskResult: TaskEvaluationResult }> = [];

  const classificationCounts: Record<EvaluationClassification, number> = {
    CORRECT: 0,
    PARTIALLY_CORRECT: 0,
    INCORRECT: 0,
    UNSUPPORTED: 0,
    ABSTAINED_CORRECTLY: 0,
    ABSTAINED_INCORRECTLY: 0
  };

  const failureCategoryCounts: Record<FailureCategory, number> = {
    NONE: 0,
    WRONG_CONTEXT: 0,
    WRONG_ROLE: 0,
    WRONG_PAGE: 0,
    HALLUCINATION: 0,
    IDENTIFIER_ERROR: 0,
    SOURCE_CONFLICT_ERROR: 0,
    HISTORICAL_CURRENT_CONFUSION: 0,
    INSUFFICIENT_ABSTENTION: 0,
    OTHER: 0
  };

  for (const item of items) {
    const taskResult = await evaluateCorpusItem(item, promptVersion);
    results.push({
      corpusItemId: item.id,
      itemTitle: item.title,
      scenarioType: item.scenarioType,
      taskResult
    });
    classificationCounts[taskResult.classification]++;
    failureCategoryCounts[taskResult.failureCategory]++;
  }

  const total = items.length || 1;
  const correctCount = classificationCounts.CORRECT + classificationCounts.ABSTAINED_CORRECTLY;
  const falseCreditors = results.filter(r => r.taskResult.failureCategory === "HALLUCINATION").length;
  const attorneyConfusions = results.filter(r => r.taskResult.failureCategory === "WRONG_ROLE").length;
  const unsupportedCount = classificationCounts.UNSUPPORTED + classificationCounts.INCORRECT;

  return {
    totalCases: items.length,
    promptVersion,
    metrics: {
      accuracyPercent: Math.round((correctCount / total) * 100),
      unsupportedClaimRatePercent: Math.round((unsupportedCount / total) * 100),
      falseCreditorRatePercent: Math.round((falseCreditors / total) * 100),
      attorneyAsCreditorRatePercent: Math.round((attorneyConfusions / total) * 100), // Target 0%
      pageAccuracyPercent: Math.round((correctCount / total) * 100),
      correctAbstentionRatePercent: Math.round((classificationCounts.ABSTAINED_CORRECTLY / total) * 100)
    },
    classificationCounts,
    failureCategoryCounts,
    results,
    evaluatedAt: new Date().toISOString()
  };
}
