import { z } from "zod";
import { sourceResultStatuses } from "./source-coverage";

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

export const initialInventoryOrigin = "BASE INICIAL — 73 DEPREs";
const initialInventorySource = "TJSP/DEPRE · Pacote 73";
const initialInventoryFile = "CP_pacote_completo_73_DEPREs.xlsx";
const inventoryMetadataSchema = z.object({
  origin: z.enum(["INITIAL_73", "OTHER"]).default("OTHER"),
  availability: z.enum(["AVAILABLE", "UNAVAILABLE", "UNDER_REVIEW"]).default("UNDER_REVIEW"),
  aiValidation: z.enum(["PENDING", "RECONFIRMED", "UPDATED", "DIVERGENCE", "NOT_FOUND"]).default("PENDING"),
  aiConfidence: z.number().min(0).max(100).nullable().default(null),
  divergenceAlert: z.string().trim().max(1000).default(""),
}).strict();
const defaultInventoryMetadata = {
  origin: "OTHER",
  availability: "UNDER_REVIEW",
  aiValidation: "PENDING",
  aiConfidence: null,
  divergenceAlert: "",
} as const;

export function inventoryMetadataForSources(sources: readonly string[], stored?: unknown) {
  const isInitial73 = sources.some((source) => source === initialInventorySource || source === initialInventoryFile);
  const metadata = stored === undefined
    ? inventoryMetadataSchema.parse({})
    : inventoryMetadataSchema.parse(stored);
  if (!isInitial73) return metadata;
  return { ...metadata, origin: "INITIAL_73" as const, availability: "AVAILABLE" as const };
}

export const officeSlotSchema=z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(120),category:z.string().trim().max(80),requiredForQualification:z.boolean(),status:z.enum(["PENDENTE","RECEBIDO","EM_CONFERENCIA","VALIDADO_PARA_TRIAGEM","DIVERGENTE","NAO_APLICAVEL","REVISAO_HUMANA"]),documentId:z.string().uuid().or(z.literal("")),source:z.string().trim().max(500),receivedAt:z.union([z.literal(""),z.iso.datetime()]),reviewedAt:z.union([z.literal(""),z.iso.datetime()]),reviewer:z.string().trim().max(160),discrepancyStatus:z.enum(["NONE","PENDING","RESOLVED"]).default("NONE"),notes:z.string().trim().max(2000)}).strict();

export const beneficiaryObservationSchema = z.object({
  id: z.string().uuid(),
  depre: z.string().regex(/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/),
  name: short,
  role: z.enum(["TITULAR", "CREDOR", "BENEFICIARIO", "REQUERENTE", "HERDEIRO", "CESSIONARIO", "UNKNOWN"]),
  status: z.enum(["UNVERIFIED_IMPORT", "HISTORICAL_CONFIRMED", "CURRENT_CONFIRMED", "DIVERGENT"]),
  source: short,
  sourceUrl: z.string().url().or(z.literal("")),
  sourceType: z.enum(["OFFICIAL_PUBLICATION", "OFFICIAL_API", "OFFICIAL_REGISTER", "IMPORTED_SNAPSHOT"]),
  provider: short,
  sourceId: short,
  route: short,
  sourceStatus: z.enum(sourceResultStatuses),
  documentIdentifier: z.string().trim().max(240),
  reference: z.string().trim().max(500),
  collectedAt: z.iso.datetime(),
  evidenceId: z.string().uuid().or(z.literal("")),
  evidenceStrength: z.enum(["STRONG", "MEDIUM", "WEAK"]).or(z.literal("")),
  lawyerName: z.string().trim().max(240),
  lawyerOab: z.string().trim().max(40),
  lawyerSource: z.string().trim().max(160),
  lawyerSourceUrl: z.string().url().or(z.literal("")),
  lawyerSourceStatus: z.enum(sourceResultStatuses).or(z.literal("")),
  context: z.string().trim().max(1000).default(""),
}).strict();

export const operationalWorkflowSchema = z.object({
  inventory: inventoryMetadataSchema.default(defaultInventoryMetadata),
  stage: z.enum(workflowStages), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]), confidence: z.number().min(0).max(100),
  client: z.object({ name: short, document: z.string().trim().max(24), phone: z.string().trim().max(32), email: z.string().trim().max(254), beneficiaries: z.array(beneficiaryObservationSchema).max(100).default([]) }).strict(),
  credit: z.object({ precatoryNumber: z.string().trim().max(120), numeroProcessoDEPRE:z.string().trim().max(120).default(""), numeroProcessoDEPRENormalizado:z.string().trim().max(120).default(""), paymentOrderNumber:z.string().trim().max(120).default(""), nature: short, grossAmount: optionalMoney, availableEstimate: optionalMoney, creditType:z.enum(["PRECATORY","RPV"]).default("PRECATORY"), municipality:z.string().trim().max(120).default(""), issuingCourt:z.string().trim().max(120).default(""), debtorState:z.string().trim().max(60).default("SP"), sourceUrl:z.string().trim().max(1000).default(""), sourceName:z.string().trim().max(160).default(""), checkedAt:z.union([z.literal(""),z.iso.datetime()]).default(""), valueDate:z.union([z.literal(""),z.iso.date()]).default(""), legalRepName:z.string().trim().max(240).default(""), legalRepOab:z.string().trim().max(40).default(""), contactSource:z.string().trim().max(500).default(""), contactCheckedAt:z.union([z.literal(""),z.iso.datetime()]).default(""), precatoryYear:z.string().trim().max(4).default(""), epesNumber:z.string().trim().max(120).default(""), epesYear:z.string().trim().max(4).default(""), principalRequisitionOfficeNumber:z.string().trim().max(120).default(""), requisitionOfficeDate:z.union([z.literal(""),z.iso.date()]).default(""), originProcessNumber:z.string().trim().max(100).default(""), requisitionProcessNumber:z.string().trim().max(100).default(""), chronologicalOrderNumber:z.string().trim().max(120).default(""), depreReference:z.string().trim().max(160).default(""), depreReferenceSource:z.string().trim().max(500).default(""), qualityOffices:z.array(officeSlotSchema).max(10).default([]), acquisitionProfileVersion:z.string().trim().max(40).default("1.0") }).strict(),
  creditorResolution:z.object({state:z.enum(["PENDENTE","CREDOR_IDENTIFICADO","CREDOR_CORROBORADO","CREDOR_PARCIALMENTE_IDENTIFICADO","CREDOR_NÃO_IDENTIFICADO","POSSÍVEL_CORRESPONDÊNCIA","CONFLITO_DE_IDENTIDADE","REVISÃO_HUMANA","FONTE_INDISPONÍVEL"]).default("PENDENTE"),confidence:z.enum(["ALTA","MÉDIA","BAIXA","NÃO DETERMINADA"]).default("NÃO DETERMINADA"),currentHolderStatus:z.enum(["CURRENT_HOLDER_CONFIRMED","CURRENT_HOLDER_NOT_CONFIRMED","POSSIBLE_TRANSFER","SUCCESSION_REVIEW","UNKNOWN"]).default("CURRENT_HOLDER_NOT_CONFIRMED"),identifiedName:z.string().trim().max(240).default(""),explanation:z.string().trim().max(2000).default("Nenhuma consulta de identidade foi realizada."),nextAction:z.string().trim().max(500).default("Resolver identidade do credor em fonte oficial."),updatedAt:z.union([z.literal(""),z.iso.datetime()]).default("")}).default({state:"PENDENTE",confidence:"NÃO DETERMINADA",currentHolderStatus:"CURRENT_HOLDER_NOT_CONFIRMED",identifiedName:"",explanation:"Nenhuma consulta de identidade foi realizada.",nextAction:"Resolver identidade do credor em fonte oficial.",updatedAt:""}),
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
    inventory: inventoryMetadataSchema.parse({}),
    stage: "NEW", priority: "MEDIUM", confidence: 0,
    client: { name: "", document: "", phone: "", email: "", beneficiaries: [] },
    credit: { precatoryNumber: "", numeroProcessoDEPRE:"", numeroProcessoDEPRENormalizado:"", paymentOrderNumber:"", nature: "", grossAmount: nominal, availableEstimate: 0, creditType:"PRECATORY", municipality:"", issuingCourt:"", debtorState:"SP", sourceUrl:"", sourceName:"", checkedAt:"", valueDate:"", legalRepName:"", legalRepOab:"", contactSource:"", contactCheckedAt:"",precatoryYear:"",epesNumber:"",epesYear:"",principalRequisitionOfficeNumber:"",requisitionOfficeDate:"",originProcessNumber:"",requisitionProcessNumber:"",chronologicalOrderNumber:"",depreReference:"",depreReferenceSource:"",qualityOffices:[{id:crypto.randomUUID(),label:"Ofício 1",category:"OFICIO_EMPRESA",requiredForQualification:true,status:"PENDENTE",documentId:"",source:"",receivedAt:"",reviewedAt:"",reviewer:"",discrepancyStatus:"NONE",notes:""},{id:crypto.randomUUID(),label:"Ofício 2",category:"OFICIO_EMPRESA",requiredForQualification:true,status:"PENDENTE",documentId:"",source:"",receivedAt:"",reviewedAt:"",reviewer:"",discrepancyStatus:"NONE",notes:""}],acquisitionProfileVersion:"1.0" },
    creditorResolution:{state:"PENDENTE",confidence:"NÃO DETERMINADA",currentHolderStatus:"CURRENT_HOLDER_NOT_CONFIRMED",identifiedName:"",explanation:"Nenhuma consulta de identidade foi realizada.",nextAction:"Resolver identidade do credor em fonte oficial.",updatedAt:""},
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

export function summarizeEvidence(evidence: z.infer<typeof evidenceSchema>[]) {
  return evidence.map((item) => ({
    source: item.source,
    sourceType: item.sourceType,
    reference: item.reference || "Sem referência",
    confidence: item.confidence,
    status: item.status,
    summary: `${item.source} · ${item.reference || "Sem referência"} · ${item.confidence}% · ${item.status}`,
  }));
}
