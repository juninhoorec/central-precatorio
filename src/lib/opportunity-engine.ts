export type OpportunityLifecycle = "AVAILABLE" | "IN_REVIEW" | "QUALIFIED" | "PRIORITIZED" | "CONTACT_PENDING" | "CONTACTED" | "NEGOTIATION" | "CLOSED" | "DISQUALIFIED";
export type OpportunityPriority = "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
export type OpportunityStatus =
  | "NOT_QUALIFIED"
  | "IN_REVIEW"
  | "QUALIFIED"
  | "READY_FOR_ANALYST"
  | "BLOCKED_BY_EVIDENCE"
  | "BLOCKED_BY_IDENTITY"
  | "BLOCKED_BY_COVERAGE"
  | "BLOCKED_BY_CONTACT"
  | "BLOCKED_BY_VALUE"
  | "BLOCKED_BY_STATUS";
export type OpportunityBlockerCode =
  | "MISSING_DEPRE"
  | "TITULAR_NOT_CONFIRMED"
  | "MULTIPLE_BENEFICIARIES_UNRESOLVED"
  | "DOCUMENTATION_BELOW_2_OF_2"
  | "INSUFFICIENT_SOURCE_COVERAGE"
  | "VALUE_NOT_CONFIRMED"
  | "DATE_BASE_NOT_CONFIRMED"
  | "PROCESS_NOT_CONFIRMED"
  | "LAWYER_NOT_CONFIRMED"
  | "CONTACT_NOT_CONFIRMED"
  | "STATUS_NOT_CONFIRMED"
  | "EXTERNAL_VERIFICATION_PENDING";

const lifecycleTransitions: Record<OpportunityLifecycle, readonly OpportunityLifecycle[]> = {
  AVAILABLE: ["IN_REVIEW", "DISQUALIFIED"], IN_REVIEW: ["QUALIFIED", "CONTACT_PENDING", "DISQUALIFIED"],
  QUALIFIED: ["PRIORITIZED", "CONTACT_PENDING", "DISQUALIFIED"], PRIORITIZED: ["CONTACT_PENDING", "CONTACTED", "DISQUALIFIED"],
  CONTACT_PENDING: ["CONTACTED", "DISQUALIFIED"], CONTACTED: ["NEGOTIATION", "CONTACT_PENDING", "DISQUALIFIED"],
  NEGOTIATION: ["CLOSED", "CONTACTED", "DISQUALIFIED"], CLOSED: [], DISQUALIFIED: ["IN_REVIEW"],
};
export function canTransitionOpportunityLifecycle(from: OpportunityLifecycle, to: OpportunityLifecycle, hasRecordedActivity = false) {
  if (from === to) return true;
  if (!lifecycleTransitions[from].includes(to)) return false;
  return to !== "CONTACTED" || hasRecordedActivity;
}
export function transitionOpportunityLifecycle(opportunity: Opportunity, to: OpportunityLifecycle, options: { hasRecordedActivity?: boolean } = {}) {
  if (!canTransitionOpportunityLifecycle(opportunity.lifecycle ?? "IN_REVIEW", to, options.hasRecordedActivity ?? false)) throw new Error("INVALID_OPPORTUNITY_LIFECYCLE_TRANSITION");
  return { ...opportunity, lifecycle: to };
}

export type OpportunityInput = {
  opportunityId: string;
  operationId: string;
  organizationId: string;
  depre: string | null;
  debtor: string | null;
  originalValue: number | null;
  currentValue: number | null;
  dataBase: string | null;
  lawyer: string | null;
  oab: string | null;
  contactAvailable: boolean;
  coverageState: "INSUFFICIENT_COVERAGE" | "PARTIAL_COVERAGE" | "SUFFICIENT_COVERAGE" | "NO_RESULT" | "AUTH_REQUIRED" | "MANUAL_REQUIRED" | "SOURCE_UNAVAILABLE" | string;
  qualifyingEvidenceCount: number;
  aiValidation: "PENDING" | "CONFIRMADO" | "NÃO_CONFIRMADO" | "DIVERGENTE" | "ATUALIZADO";
  divergence: boolean;
  availability: "AVAILABLE" | "UNAVAILABLE" | "PENDING" | string;
  lifecycle?: OpportunityLifecycle;
  status?: OpportunityStatus;
  blockerCodes?: readonly OpportunityBlockerCode[];
  /** Optional provenance-aware states used by O3; absent keeps the legacy contract. */
  titularStatus?: "CONFIRMED" | "UNRESOLVED" | "HOMONYM_RISK" | string;
  valueStatus?: "CONFIRMED" | "HISTORICAL" | "MISSING" | "UNCONFIRMED" | string;
  lawyerStatus?: "CONFIRMED" | "UNCONFIRMED" | "MISSING" | string;
  contactStatus?: "CONFIRMED" | "PROFESSIONAL_ROUTE" | "NO_CONFIRMED_CONTACT" | string;
  processStatus?: "CONFIRMED" | "PENDING" | "MISSING" | string;
  researchStatus?: string;
  ruleVersion?: string;
};

export type Opportunity = OpportunityInput & {
  score: number;
  priority: OpportunityPriority;
  scoreComponents: Record<string, number>;
  alerts: string[];
  positiveSignals: string[];
  blockingReasons: string[];
  blockerCodes: OpportunityBlockerCode[];
  documentationStatus: string;
  readyForAnalyst: boolean;
  evaluationVersion: string;
  status: OpportunityStatus;
};

export function deriveTitularStatusFromBeneficiaries(beneficiaries: readonly { role: string; status: string }[]) {
  const currentTitularCount = beneficiaries.filter((beneficiary) =>
    beneficiary.role === "TITULAR" && beneficiary.status === "CURRENT_CONFIRMED",
  ).length;
  return currentTitularCount === 1 ? "CONFIRMED" as const : "UNRESOLVED" as const;
}

function deriveBlockerCodes(input: OpportunityInput): OpportunityBlockerCode[] {
  const blockers = new Set<OpportunityBlockerCode>();
  if (!input.depre) blockers.add("MISSING_DEPRE");
  if (input.titularStatus !== "CONFIRMED") blockers.add("TITULAR_NOT_CONFIRMED");
  if (input.qualifyingEvidenceCount < 2) blockers.add("DOCUMENTATION_BELOW_2_OF_2");
  if (input.coverageState !== "SUFFICIENT_COVERAGE") blockers.add("INSUFFICIENT_SOURCE_COVERAGE");
  if ((input.valueStatus && input.valueStatus !== "CONFIRMED") || input.originalValue === null) blockers.add("VALUE_NOT_CONFIRMED");
  if (!input.dataBase) blockers.add("DATE_BASE_NOT_CONFIRMED");
  if (!input.processStatus || (input.processStatus !== "CONFIRMED" && input.processStatus !== "VERIFIED")) blockers.add("PROCESS_NOT_CONFIRMED");
  if (!input.lawyer || !input.oab || (input.lawyerStatus && input.lawyerStatus !== "CONFIRMED")) blockers.add("LAWYER_NOT_CONFIRMED");
  if ((!input.contactAvailable && (!input.contactStatus || input.contactStatus === "NO_CONFIRMED_CONTACT")) || (input.contactStatus && input.contactStatus !== "CONFIRMED" && input.contactStatus !== "PROFESSIONAL_ROUTE")) blockers.add("CONTACT_NOT_CONFIRMED");
  if (input.blockerCodes) for (const code of input.blockerCodes) blockers.add(code as OpportunityBlockerCode);
  return [...blockers];
}

function deriveStatus(blockerCodes: readonly OpportunityBlockerCode[]): OpportunityStatus {
  if (blockerCodes.includes("TITULAR_NOT_CONFIRMED") || blockerCodes.includes("MULTIPLE_BENEFICIARIES_UNRESOLVED")) return "BLOCKED_BY_IDENTITY";
  if (blockerCodes.includes("DOCUMENTATION_BELOW_2_OF_2")) return "BLOCKED_BY_EVIDENCE";
  if (blockerCodes.includes("INSUFFICIENT_SOURCE_COVERAGE")) return "BLOCKED_BY_COVERAGE";
  if (blockerCodes.includes("CONTACT_NOT_CONFIRMED")) return "BLOCKED_BY_CONTACT";
  if (blockerCodes.includes("VALUE_NOT_CONFIRMED") || blockerCodes.includes("DATE_BASE_NOT_CONFIRMED")) return "BLOCKED_BY_VALUE";
  if (blockerCodes.includes("PROCESS_NOT_CONFIRMED") || blockerCodes.includes("STATUS_NOT_CONFIRMED")) return "BLOCKED_BY_STATUS";
  return "IN_REVIEW";
}

function deriveBlockingReasons(blockerCodes: readonly OpportunityBlockerCode[]): string[] {
  const reasonMap: Record<OpportunityBlockerCode, string> = {
    MISSING_DEPRE: "MISSING_DEPRE",
    TITULAR_NOT_CONFIRMED: "TITULAR_NOT_CONFIRMED",
    MULTIPLE_BENEFICIARIES_UNRESOLVED: "MULTIPLE_BENEFICIARIES_UNRESOLVED",
    DOCUMENTATION_BELOW_2_OF_2: "DOCUMENTATION_INSUFFICIENT",
    INSUFFICIENT_SOURCE_COVERAGE: "INSUFFICIENT_SOURCE_COVERAGE",
    VALUE_NOT_CONFIRMED: "VALUE_NOT_CONFIRMED",
    DATE_BASE_NOT_CONFIRMED: "DATE_BASE_NOT_CONFIRMED",
    PROCESS_NOT_CONFIRMED: "PROCESS_NOT_CONFIRMED",
    LAWYER_NOT_CONFIRMED: "LAWYER_NOT_CONFIRMED",
    CONTACT_NOT_CONFIRMED: "CONTACT_NOT_CONFIRMED",
    STATUS_NOT_CONFIRMED: "STATUS_NOT_CONFIRMED",
    EXTERNAL_VERIFICATION_PENDING: "EXTERNAL_VERIFICATION_PENDING",
  };
  return [...new Set(blockerCodes.map((code) => reasonMap[code] ?? code))];
}

export function scoreOpportunity(input: OpportunityInput): Opportunity {
  const blockerCodes = deriveBlockerCodes(input);
  const blockingReasons = deriveBlockingReasons(blockerCodes);
  const components = {
    documentation: Math.min(25, input.qualifyingEvidenceCount * 12.5),
    coverage: input.coverageState === "SUFFICIENT_COVERAGE" ? 25 : input.coverageState === "PARTIAL_COVERAGE" ? 12 : 0,
    contact: input.contactAvailable ? 15 : 0,
    lawyer: input.lawyer && input.oab ? 10 : input.lawyer ? 5 : 0,
    value: (input.valueStatus ? input.valueStatus === "CONFIRMED" : input.originalValue !== null) ? 10 : 0,
    database: input.dataBase ? 10 : 0,
    confidence: input.aiValidation === "CONFIRMADO" || input.aiValidation === "ATUALIZADO" ? 5 : 0,
  };
  const score = Math.round(Object.values(components).reduce((sum, value) => sum + value, 0));

  const positiveSignals = [
    ...(input.depre ? ["DEPRE_PRESENT"] : []),
    ...(input.qualifyingEvidenceCount > 0 ? ["OFFICIAL_DOCUMENT_FOUND"] : []),
    ...(input.qualifyingEvidenceCount >= 2 ? ["DOCUMENTATION_2_OF_2"] : []),
    ...(input.coverageState === "SUFFICIENT_COVERAGE" ? ["SOURCE_COVERAGE_SUFFICIENT"] : []),
    ...(input.contactStatus === "CONFIRMED" || (!input.contactStatus && input.contactAvailable) ? ["CONTACT_CONFIRMED"] : input.contactStatus === "PROFESSIONAL_ROUTE" ? ["PROFESSIONAL_ROUTE_AVAILABLE"] : []),
    ...(input.valueStatus === "CONFIRMED" ? ["VALUE_CONFIRMED"] : []),
    ...(input.lawyerStatus === "CONFIRMED" || (!input.lawyerStatus && input.lawyer && input.oab) ? ["LAWYER_CONFIRMED"] : []),
  ];
  const priority: OpportunityPriority = input.divergence || input.coverageState === "INSUFFICIENT_COVERAGE" || input.titularStatus === "HOMONYM_RISK" ? "REVIEW" : score >= 75 ? "HIGH" : score >= 45 ? "MEDIUM" : "LOW";
  const alerts = [
    ...(input.coverageState !== "SUFFICIENT_COVERAGE" ? ["INSUFFICIENT_COVERAGE"] : []),
    ...(input.qualifyingEvidenceCount < 2 ? ["DOCUMENTATION_BELOW_2_OF_2"] : []),
    ...(input.divergence ? ["DIVERGENCE_DETECTED"] : []),
    ...(input.originalValue === null ? ["MISSING_VALUE"] : []),
    ...(input.dataBase === null ? ["MISSING_DATABASE_DATE"] : []),
    ...(input.lawyer === null ? ["MISSING_LAWYER"] : []),
    ...(!input.contactAvailable ? ["MISSING_CONTACT_ROUTE"] : []),
    ...(input.aiValidation === "PENDING" ? ["AI_PENDING"] : []),
  ];
  const documentationStatus = input.qualifyingEvidenceCount >= 3 ? "3/2+" : `${Math.min(2, input.qualifyingEvidenceCount)}/2`;
  const readyForAnalyst = blockerCodes.length === 0 && input.qualifyingEvidenceCount >= 2 && input.titularStatus === "CONFIRMED" && (input.contactStatus === "CONFIRMED" || input.contactStatus === "PROFESSIONAL_ROUTE" || input.contactAvailable) && input.coverageState === "SUFFICIENT_COVERAGE" && !input.divergence && !!input.dataBase && (input.processStatus === "CONFIRMED" || input.processStatus === "VERIFIED") && (input.originalValue !== null && input.originalValue > 0) && (input.valueStatus === "CONFIRMED" || input.valueStatus === "HISTORICAL");
  const legacyStatus = input.status === "READY_FOR_ANALYST" || input.status === "QUALIFIED" ? "IN_REVIEW" : input.status;
  const derivedStatus = readyForAnalyst ? "READY_FOR_ANALYST" : blockerCodes.length ? deriveStatus(blockerCodes) : (legacyStatus ?? "IN_REVIEW");
  const status: OpportunityStatus = derivedStatus;

  return {
    ...input,
    lifecycle: input.lifecycle ?? (readyForAnalyst ? "PRIORITIZED" : "IN_REVIEW"),
    score,
    priority,
    scoreComponents: components,
    alerts,
    positiveSignals,
    blockingReasons,
    blockerCodes,
    documentationStatus,
    readyForAnalyst,
    evaluationVersion: input.ruleVersion ?? "opportunity-rules-v3",
    status,
  };
}

export type OpportunityFilter = Partial<Pick<Opportunity, "depre" | "debtor" | "priority" | "lifecycle" | "availability" | "coverageState" | "aiValidation" | "divergence" | "lawyer" | "oab">> & { minValue?: number; maxValue?: number };

export function filterOpportunities(items: readonly Opportunity[], filter: OpportunityFilter): Opportunity[] {
  return items.filter((item) => (!filter.depre || item.depre === filter.depre) && (!filter.debtor || item.debtor === filter.debtor) && (!filter.priority || item.priority === filter.priority) && (!filter.lifecycle || item.lifecycle === filter.lifecycle) && (!filter.availability || item.availability === filter.availability) && (!filter.coverageState || item.coverageState === filter.coverageState) && (filter.aiValidation === undefined || item.aiValidation === filter.aiValidation) && (filter.divergence === undefined || item.divergence === filter.divergence) && (!filter.lawyer || item.lawyer === filter.lawyer) && (!filter.oab || item.oab === filter.oab) && (filter.minValue === undefined || (item.currentValue ?? item.originalValue ?? -Infinity) >= filter.minValue) && (filter.maxValue === undefined || (item.currentValue ?? item.originalValue ?? Infinity) <= filter.maxValue));
}
