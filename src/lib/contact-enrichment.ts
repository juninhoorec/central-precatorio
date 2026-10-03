export type ContactRole = "TITULAR" | "ADVOGADO" | "ESCRITORIO" | "EMPRESA" | "INSTITUICAO" | "MANUAL_ROUTE";
export type ContactStatus = "CONFIRMED" | "PROFESSIONAL_ROUTE" | "NOT_CONFIRMED" | "NEEDS_REVIEW";
export type ContactCandidate = { contactId: string; operationId: string; opportunityId?: string; entityReference: string; role: ContactRole; contactType: "PHONE" | "EMAIL" | "WEBSITE" | "PROFILE" | "MANUAL"; phone?: string | null; email?: string | null; website?: string | null; profile?: string | null; organization?: string | null; lawyer?: string | null; oab?: string | null; source: string; sourceUrl: string | null; evidenceId: string | null; confidence: ContactStatus; verificationStatus: ContactStatus; discoveredAt: string; lastVerifiedAt: string | null; provenance: Record<string, string>; notes?: string | null };

export function normalizePhone(value: string): string | null { const digits = value.replace(/\D/g, ""); return digits.length >= 8 ? digits : null; }
export function normalizeEmail(value: string): string | null { const email = value.trim().toLowerCase(); return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null; }
export function normalizeUrl(value: string): string | null { try { const url = new URL(value.trim()); if (url.protocol !== "http:" && url.protocol !== "https:") return null; url.hash = ""; return url.toString().replace(/\/$/, ""); } catch { return null; } }
export function normalizeOab(value: string): string | null { const match = value.toUpperCase().replace(/\s+/g, " ").match(/(?:OAB\s*)?([A-Z]{2})?\s*(\d{1,8})/); return match ? `${match[1] ? `${match[1]} ` : ""}${match[2]}` : null; }

export function classifyContact(input: Pick<ContactCandidate, "role" | "sourceUrl" | "evidenceId" | "entityReference" | "lawyer" | "oab">): ContactStatus {
  if (!input.entityReference.trim()) return "NEEDS_REVIEW";
  if (input.evidenceId && input.sourceUrl) return "CONFIRMED";
  if (input.role === "ADVOGADO" || input.role === "ESCRITORIO" || input.lawyer || input.oab) return "PROFESSIONAL_ROUTE";
  return "NOT_CONFIRMED";
}

export function deduplicateContacts(items: readonly ContactCandidate[]): ContactCandidate[] {
  const seen = new Set<string>();
  return items.filter((item) => { const key = [item.operationId, item.role, normalizePhone(item.phone ?? "") ?? "", normalizeEmail(item.email ?? "") ?? "", normalizeUrl(item.website ?? "") ?? "", item.entityReference.trim().toLowerCase()].join("|"); if (seen.has(key)) return false; seen.add(key); return true; });
}
