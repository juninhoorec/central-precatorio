export type EnrichmentFactStatus = "CONFIRMED" | "LOCALIZADO" | "NÃO_CONFIRMADO" | "NÃO_LOCALIZADO";
export type DepreEnrichmentFacts = {
  depre: string;
  titularCandidates: readonly string[];
  titularLinkedByOfficialDocument: boolean;
  originProcess: string | null;
  seiProcess: string | null;
  lawyer: string | null;
  oab: string | null;
  value: number | null;
  valueStatus: "ORIGINAL" | "HISTORICAL" | "CURRENT" | "UNKNOWN";
  dataBase: string | null;
  contactStatus: "CONFIRMED_CONTACT" | "PROFESSIONAL_ROUTE" | "NO_CONFIRMED_CONTACT";
};
export type DepreEnrichmentAssessment = DepreEnrichmentFacts & {
  titularStatus: EnrichmentFactStatus;
  lawyerStatus: EnrichmentFactStatus;
  oabStatus: EnrichmentFactStatus;
  originProcessStatus: EnrichmentFactStatus;
  seiStatus: EnrichmentFactStatus;
  valueStatusLabel: EnrichmentFactStatus;
  dataBaseStatus: EnrichmentFactStatus;
  contactRouteStatus: EnrichmentFactStatus;
  warnings: string[];
};

/** Conservative field consolidation: it never mutates the operation. */
export function assessDepreEnrichment(facts: DepreEnrichmentFacts): DepreEnrichmentAssessment {
  const warnings: string[] = [];
  const titularStatus: EnrichmentFactStatus = facts.titularLinkedByOfficialDocument && facts.titularCandidates.length === 1 ? "CONFIRMED" : facts.titularCandidates.length > 0 ? "NÃO_CONFIRMADO" : "NÃO_LOCALIZADO";
  if (facts.titularCandidates.length > 1) warnings.push("MULTIPLE_HISTORICAL_TITULAR_CANDIDATES");
  const lawyerStatus: EnrichmentFactStatus = facts.lawyer ? "LOCALIZADO" : "NÃO_LOCALIZADO";
  const oabStatus: EnrichmentFactStatus = facts.oab ? "CONFIRMED" : "NÃO_LOCALIZADO";
  const originProcessStatus: EnrichmentFactStatus = facts.originProcess ? "LOCALIZADO" : "NÃO_LOCALIZADO";
  const seiStatus: EnrichmentFactStatus = facts.seiProcess ? "LOCALIZADO" : "NÃO_LOCALIZADO";
  const valueStatusLabel: EnrichmentFactStatus = facts.value !== null && facts.valueStatus !== "UNKNOWN" ? "LOCALIZADO" : "NÃO_LOCALIZADO";
  const dataBaseStatus: EnrichmentFactStatus = facts.dataBase ? "LOCALIZADO" : "NÃO_LOCALIZADO";
  const contactRouteStatus: EnrichmentFactStatus = facts.contactStatus === "CONFIRMED_CONTACT" ? "CONFIRMED" : facts.contactStatus === "PROFESSIONAL_ROUTE" ? "LOCALIZADO" : "NÃO_LOCALIZADO";
  if (facts.lawyer && !facts.oab) warnings.push("LAWYER_LOCATED_OAB_NOT_LOCATED");
  if (facts.valueStatus === "HISTORICAL") warnings.push("HISTORICAL_VALUE_NOT_CURRENT");
  return { ...facts, titularStatus, lawyerStatus, oabStatus, originProcessStatus, seiStatus, valueStatusLabel, dataBaseStatus, contactRouteStatus, warnings };
}
