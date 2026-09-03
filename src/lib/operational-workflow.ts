import { z } from "zod";

export const workflowStages = [
  "NEW", "TRIAGE", "QUERY", "VALIDATION", "DOCUMENTS", "LEGAL_REVIEW",
  "APPROVED", "PROPOSAL", "NEGOTIATION", "ACCEPTED", "CESSION",
  "POST_CESSION", "COMPLETED", "REJECTED", "LOST", "BLOCKED", "CANCELLED",
] as const;

export const allowedTransitions: Record<(typeof workflowStages)[number], readonly (typeof workflowStages)[number][]> = {
  NEW: ["TRIAGE", "CANCELLED"], TRIAGE: ["QUERY", "REJECTED", "BLOCKED"],
  QUERY: ["VALIDATION", "BLOCKED", "REJECTED"], VALIDATION: ["DOCUMENTS", "BLOCKED", "REJECTED"],
  DOCUMENTS: ["LEGAL_REVIEW", "BLOCKED"], LEGAL_REVIEW: ["APPROVED", "DOCUMENTS", "REJECTED", "BLOCKED"],
  APPROVED: ["PROPOSAL", "BLOCKED"], PROPOSAL: ["NEGOTIATION", "LOST", "BLOCKED"],
  NEGOTIATION: ["ACCEPTED", "LOST", "BLOCKED"], ACCEPTED: ["CESSION", "CANCELLED"],
  CESSION: ["POST_CESSION", "BLOCKED", "CANCELLED"], POST_CESSION: ["COMPLETED", "BLOCKED"],
  COMPLETED: [], REJECTED: [], LOST: [], BLOCKED: ["TRIAGE", "QUERY", "VALIDATION", "DOCUMENTS", "LEGAL_REVIEW", "PROPOSAL", "NEGOTIATION", "CESSION", "POST_CESSION", "CANCELLED"], CANCELLED: [],
};

const short = z.string().trim().max(240);
const optionalMoney = z.number().finite().nonnegative().max(1_000_000_000_000);

export const evidenceSchema = z.object({
  id: z.string().uuid(), source: short, sourceType: z.enum(["OFFICIAL", "DOCUMENT", "MANUAL", "PROVIDER"]),
  reference: z.string().trim().max(1000), retrievedAt: z.iso.datetime(), confidence: z.number().min(0).max(100),
  status: z.enum(["CONFIRMADO", "COMPATÍVEL", "INCOMPLETO", "NÃO ENCONTRADO", "FONTE INDISPONÍVEL", "REVISÃO HUMANA NECESSÁRIA"]),
  notes: z.string().trim().max(2000),
}).strict();

export const validationSchema = z.object({
  id: z.string().uuid(), check: short, severity: z.enum(["INFO", "WARNING", "CRITICAL"]),
  status: z.enum(["PENDING", "PASSED", "FAILED", "HUMAN_REVIEW"]), explanation: z.string().trim().max(2000),
}).strict();

export const legalReviewSchema = z.object({
  id: z.string().uuid(), status: z.enum(["PENDING", "APPROVED", "APPROVED_WITH_REMARKS", "NEEDS_DOCUMENTS", "REJECTED"]),
  reviewer: short, requestedAt: z.iso.datetime(), reviewedAt: z.union([z.literal(""), z.iso.datetime()]),
  observations: z.string().trim().max(6000), dossierVersion: z.number().int().positive(),
}).strict();

export const pricingScenarioSchema = z.object({
  id: z.string().uuid(), name: z.enum(["CONSERVADOR", "BASE", "AGRESSIVO"]), grossAmount: optionalMoney,
  deductions: optionalMoney, encumbrances: optionalMoney, transactionCosts: optionalMoney,
  targetMarginPercent: z.number().min(0).max(100), availableAmount: optionalMoney,
  offerAmount: optionalMoney, createdAt: z.iso.datetime(), assumptions: z.string().trim().max(4000),
}).strict();

export const negotiationSchema = z.object({
  id: z.string().uuid(), type: z.enum(["DRAFT","OFFER", "SENT", "COUNTEROFFER", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"]),
  amount: optionalMoney, at: z.iso.datetime(), author: short, conditions: z.string().trim().max(4000), internalNotes:z.string().trim().max(4000).optional(),
}).strict();

export const monitoringEventSchema = z.object({
  id: z.string().uuid(), date: z.iso.datetime(), type: z.enum(["MOVIMENTO_PROCESSUAL","PAGAMENTO","PROTOCOLO","COMUNICACAO","DOCUMENTO","ALERTA","OUTRO"]), source: short,
  description: z.string().trim().max(3000), importance: z.enum(["LOW", "MEDIUM", "HIGH"]), reviewed: z.boolean(), linkedTaskId:z.string().uuid().optional(),
}).strict();

export const operationalWorkflowSchema = z.object({
  stage: z.enum(workflowStages), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]), confidence: z.number().min(0).max(100),
  client: z.object({ name: short, document: z.string().trim().max(24), phone: z.string().trim().max(32), email: z.string().trim().max(254) }).strict(),
  credit: z.object({ precatoryNumber: z.string().trim().max(120), nature: short, grossAmount: optionalMoney, availableEstimate: optionalMoney }).strict(),
  nextAction: z.object({ title: short, dueAt: z.union([z.literal(""), z.iso.date(), z.iso.datetime()]), status: z.enum(["PENDING", "DONE", "BLOCKED"]), owner:short.optional(), reason:z.string().trim().max(1000).optional() }).strict(),
  queryStatus: z.enum(["NOT_STARTED", "RUNNING", "CONFIRMED", "PARTIAL", "UNAVAILABLE", "MANUAL_REQUIRED"]),
  documentStatus: z.enum(["MISSING", "INCOMPLETE", "READY", "REVIEW_REQUIRED"]),
  legalStatus: z.enum(["NOT_STARTED", "PENDING", "APPROVED", "REMARKS", "REJECTED"]),
  commercialStatus: z.enum(["NOT_STARTED", "PRICING", "OFFERED", "NEGOTIATING", "ACCEPTED", "LOST"]),
  cessionStatus: z.enum(["NOT_STARTED", "DOCUMENT_CHECK", "LEGAL_APPROVAL", "FORMALIZATION", "PROTOCOL", "COMMUNICATION", "MONITORING", "COMPLETED", "CANCELLED"]),
  evidence: z.array(evidenceSchema).max(300), validations: z.array(validationSchema).max(300),
  legalReviews: z.array(legalReviewSchema).max(100), pricingScenarios: z.array(pricingScenarioSchema).max(100),
  negotiations: z.array(negotiationSchema).max(300), monitoring: z.array(monitoringEventSchema).max(500),
}).strict();

export type OperationalWorkflow = z.infer<typeof operationalWorkflowSchema>;

export function createDefaultWorkflow(nominal = 0): OperationalWorkflow {
  return {
    stage: "NEW", priority: "MEDIUM", confidence: 0,
    client: { name: "", document: "", phone: "", email: "" },
    credit: { precatoryNumber: "", nature: "", grossAmount: nominal, availableEstimate: 0 },
    nextAction: { title: "Qualificar dados iniciais", dueAt: "", status: "PENDING" },
    queryStatus: "NOT_STARTED", documentStatus: "MISSING", legalStatus: "NOT_STARTED",
    commercialStatus: "NOT_STARTED", cessionStatus: "NOT_STARTED",
    evidence: [], validations: [], legalReviews: [], pricingScenarios: [], negotiations: [], monitoring: [],
  };
}

export function canTransition(from: OperationalWorkflow["stage"], to: OperationalWorkflow["stage"]) {
  return allowedTransitions[from].includes(to);
}

export function transitionBlockReason(workflow:OperationalWorkflow,to:OperationalWorkflow["stage"]){
  if(!canTransition(workflow.stage,to))return "Transição fora da sequência operacional permitida.";
  if(to==="LEGAL_REVIEW"&&workflow.documentStatus!=="READY")return "Conclua a conferência documental antes de enviar ao jurídico.";
  if(to==="APPROVED"&&!workflow.legalReviews.some(r=>r.status==="APPROVED"||r.status==="APPROVED_WITH_REMARKS"))return "Registre uma decisão jurídica humana antes de aprovar.";
  if(to==="PROPOSAL"&&workflow.pricingScenarios.length===0)return "Crie ao menos um cenário de precificação antes da proposta.";
  if(to==="NEGOTIATION"&&!workflow.negotiations.some(n=>["OFFER","SENT"].includes(n.type)))return "Registre uma oferta antes de iniciar a negociação.";
  if(to==="ACCEPTED"&&!workflow.negotiations.some(n=>n.type==="ACCEPTED"))return "Registre o aceite explícito antes de avançar.";
  if(to==="POST_CESSION"&&!['MONITORING','COMPLETED'].includes(workflow.cessionStatus))return "Registre o marco de monitoramento da cessão antes de avançar.";
  if(to==="COMPLETED"&&!workflow.monitoring.some(event=>event.reviewed))return "Revise ao menos um evento de monitoramento antes de concluir.";
  return null;
}

export function calculatePricing(input: Pick<z.infer<typeof pricingScenarioSchema>, "grossAmount" | "deductions" | "encumbrances" | "transactionCosts" | "targetMarginPercent">) {
  const availableAmount = Math.max(0, input.grossAmount - input.deductions - input.encumbrances);
  const offerAmount = Math.max(0, availableAmount * (1 - input.targetMarginPercent / 100) - input.transactionCosts);
  return { availableAmount: Math.round(availableAmount * 100) / 100, offerAmount: Math.round(offerAmount * 100) / 100 };
}

export function nextActionFor(workflow: OperationalWorkflow) {
  if (["COMPLETED","REJECTED","LOST","CANCELLED"].includes(workflow.stage)) return "Fluxo encerrado";
  if (workflow.validations.some(v => v.severity === "CRITICAL" && v.status !== "PASSED")) return "Resolver divergência crítica";
  if (workflow.documentStatus === "MISSING" || workflow.documentStatus === "INCOMPLETE") return "Solicitar documentos pendentes";
  if (workflow.legalStatus === "PENDING") return "Acompanhar revisão jurídica";
  if (workflow.legalStatus === "REMARKS") return "Resolver ressalvas jurídicas";
  if (workflow.commercialStatus === "OFFERED" || workflow.commercialStatus === "NEGOTIATING") return "Acompanhar proposta";
  if (workflow.commercialStatus === "ACCEPTED" && workflow.cessionStatus === "NOT_STARTED") return "Abrir checklist de cessão";
  return workflow.nextAction.title || "Definir próxima ação";
}
