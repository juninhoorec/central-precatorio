import { describe, expect, it } from "vitest";
import { classifyContact, deduplicateContacts, normalizeEmail, normalizeOab, normalizePhone, normalizeUrl } from "./contact-enrichment";

describe("contact enrichment", () => {
  it("normalizes public contact channels without inventing values", () => { expect(normalizePhone("+55 (11) 99999-0000")).toBe("5511999990000"); expect(normalizeEmail(" Lawyer@Example.COM ")).toBe("lawyer@example.com"); expect(normalizeUrl("https://example.com/#bio")).toBe("https://example.com"); expect(normalizeOab("OAB SP 12345")).toBe("SP 12345"); });
  it("protects roles and homonyms", () => { expect(classifyContact({ role: "TITULAR", sourceUrl: null, evidenceId: null, entityReference: "same name", lawyer: null, oab: null })).toBe("NOT_CONFIRMED"); expect(classifyContact({ role: "ADVOGADO", sourceUrl: "https://office.example", evidenceId: null, entityReference: "lawyer", lawyer: "Dr A", oab: null })).toBe("PROFESSIONAL_ROUTE"); });
  it("deduplicates repeated captures using operation and normalized channel context", () => { const base = { contactId: "1", operationId: "op", entityReference: "Dr A", role: "ADVOGADO" as const, contactType: "EMAIL" as const, email: "A@EXAMPLE.COM", source: "official", sourceUrl: "https://example.com", evidenceId: null, confidence: "PROFESSIONAL_ROUTE" as const, verificationStatus: "PROFESSIONAL_ROUTE" as const, discoveredAt: "2026-01-01", lastVerifiedAt: null, provenance: {} }; expect(deduplicateContacts([base, { ...base, contactId: "2" }])).toHaveLength(1); });
});
