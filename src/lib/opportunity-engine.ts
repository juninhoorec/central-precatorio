export type OpportunityLifecycle = "AVAILABLE" | "IN_REVIEW" | "QUALIFIED" | "PRIORITIZED" | "CONTACT_PENDING" | "CONTACTED" | "NEGOTIATION" | "CLOSED" | "DISQUALIFIED";
export type OpportunityPriority = "HIGH" | "MEDIUM" | "LOW" | "REVIEW";
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
  coverageState: "INSUFFICIENT_COVERAGE" | "PARTIAL_COVERAGE" | "SUFFICIENT_COVERAGE" | string;
  qualifyingEvidenceCount: number;
  aiValidation: "PENDING" | "CONFIRMADO" | "NÃO_CONFIRMADO" | "DIVERGENTE" | "ATUALIZADO";
  divergence: boolean;
  availability: "AVAILABLE" | "UNAVAILABLE" | "PENDING" | string;
  lifecycle?: OpportunityLifecycle;
  /** Optional provenance-aware states used by O3; absent keeps the legacy contract. */
  titularStatus?: "CONFIRMED" | "UNRESOLVED" | "HOMONYM_RISK" | string;
  valueStatus?: "CONFIRMED" | "HISTORICAL" | "MISSING" | "UNCONFIRMED" | string;
  lawyerStatus?: "CONFIRMED" | "UNCONFIRMED" | "MISSING" | string;
  contactStatus?: "CONFIRMED" | "PROFESSIONAL_ROUTE" | "NO_CONFIRMED_CONTACT" | string;
  researchStatus?: string;
  ruleVersion?: string;
};

export type Opportunity = OpportunityInput & { score: number; priority: OpportunityPriority; scoreComponents: Record<string, number>; alerts: string[]; positiveSignals: string[]; blockingReasons: string[]; documentationStatus: string; readyForAnalyst: boolean; evaluationVersion: string };

export function scoreOpportunity(input: OpportunityInput): Opportunity {
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
  const blockingReasons = [
    ...(input.titularStatus && input.titularStatus !== "CONFIRMED" ? [input.titularStatus === "HOMONYM_RISK" ? "HOMONYM_RISK" : "TITULAR_NOT_CONFIRMED"] : []),
    ...(input.qualifyingEvidenceCount < 2 ? ["DOCUMENTATION_INSUFFICIENT"] : []),
    ...(input.coverageState === "INSUFFICIENT_COVERAGE" ? ["SOURCE_COVERAGE_INSUFFICIENT"] : []),
    ...(input.coverageState === "PARTIAL_COVERAGE" ? ["SOURCE_COVERAGE_PARTIAL"] : []),
    ...(input.valueStatus && input.valueStatus !== "CONFIRMED" ? ["VALUE_NOT_CONFIRMED"] : input.originalValue === null ? ["VALUE_NOT_CONFIRMED"] : []),
    ...(!input.contactAvailable ? ["CONTACT_NOT_CONFIRMED"] : []),
    ...(input.divergence ? ["DATA_DIVERGENCE"] : []),
    ...(input.researchStatus === "MANUAL_REQUIRED" ? ["MANUAL_RESEARCH_REQUIRED"] : []),
  ];
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
  const readyForAnalyst = input.qualifyingEvidenceCount >= 2 && input.titularStatus === "CONFIRMED" && (input.contactStatus === "CONFIRMED" || input.contactStatus === "PROFESSIONAL_ROUTE") && input.coverageState === "SUFFICIENT_COVERAGE" && !input.divergence;
  return { ...input, lifecycle: input.lifecycle ?? (readyForAnalyst ? "PRIORITIZED" : "IN_REVIEW"), score, priority, scoreComponents: components, alerts, positiveSignals, blockingReasons, documentationStatus, readyForAnalyst, evaluationVersion: input.ruleVersion ?? "opportunity-rules-v1" };
}

export type OpportunityFilter = Partial<Pick<Opportunity, "depre" | "debtor" | "priority" | "lifecycle" | "availability" | "coverageState" | "aiValidation" | "divergence" | "lawyer" | "oab">> & { minValue?: number; maxValue?: number };

export function filterOpportunities(items: readonly Opportunity[], filter: OpportunityFilter): Opportunity[] {
  return items.filter((item) => (!filter.depre || item.depre === filter.depre) && (!filter.debtor || item.debtor === filter.debtor) && (!filter.priority || item.priority === filter.priority) && (!filter.lifecycle || item.lifecycle === filter.lifecycle) && (!filter.availability || item.availability === filter.availability) && (!filter.coverageState || item.coverageState === filter.coverageState) && (filter.aiValidation === undefined || item.aiValidation === filter.aiValidation) && (filter.divergence === undefined || item.divergence === filter.divergence) && (!filter.lawyer || item.lawyer === filter.lawyer) && (!filter.oab || item.oab === filter.oab) && (filter.minValue === undefined || (item.currentValue ?? item.originalValue ?? -Infinity) >= filter.minValue) && (filter.maxValue === undefined || (item.currentValue ?? item.originalValue ?? Infinity) <= filter.maxValue));
}
