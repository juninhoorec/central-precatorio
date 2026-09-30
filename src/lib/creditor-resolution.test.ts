import { describe, expect, it } from "vitest";
import { discoverBeneficiaryContacts, resolveCreditor, resolveOfficialDocuments, type CreditorCandidateInput } from "./creditor-resolution";

const identifiers = {
  numeroProcessoDEPRE: "0032722-57.2014.8.26.0500",
  epes: "5910/2014",
  originProcessNumber: "0008831-10.2002.8.26.0053",
  precatoryNumber: "PRC-TEST-1",
  debtor: "FAZENDA DO ESTADO DE SÃO PAULO",
};
const officialCandidate = (overrides: Partial<CreditorCandidateInput> = {}): CreditorCandidateInput => ({
  displayName: "Pessoa Exemplo",
  debtorName: identifiers.debtor,
  personType: "PERSON",
  role: "BENEFICIÁRIO",
  maskedCpf: "",
  matchedField: "numeroProcessoDEPRE",
  matchedValue: identifiers.numeroProcessoDEPRE,
  evidenceExcerpt: `Beneficiário indicado para o processo DEPRE ${identifiers.numeroProcessoDEPRE}`,
  source: "TJSP/CAC · Pesquisa de Precatórios",
  sourceUrl: "https://www.tjsp.jus.br/cac/scp/pesquisainternetv2.aspx",
  sourceReferenceDate: "",
  sourcePage: null,
  officialRoleConfirmed: true,
  currentHolderClaim: "UNKNOWN",
  ...overrides,
});
const input = (overrides:Partial<Parameters<typeof resolveCreditor>[0]> = {}) => ({
  queryState: "RESULTS_FOUND" as const,
  resultCount: 1,
  candidates: [officialCandidate()],
  previousCandidates: [],
  identifiers,
  ...overrides,
});

describe("deterministic creditor resolution", () => {
  it("identifies a beneficiary only with explicit official role and exact DEPRE", () => {
    const result = resolveCreditor(input());
    expect(result.state).toBe("CREDOR_IDENTIFICADO");
    expect(result.confidence).toBe("ALTA");
    expect(result.currentHolderStatus).toBe("CURRENT_HOLDER_NOT_CONFIRMED");
  });

  it("keeps attorney separate from creditor", () => {
    const result = resolveCreditor(input({ candidates: [officialCandidate({ role: "ADVOGADO" })] }));
    expect(result.state).toBe("CREDOR_NÃO_IDENTIFICADO");
    expect(result.selectedCandidate).toBeNull();
    expect(result.explanation).toContain("advogado não é credor");
  });

  it("does not identify a similar name without an exact identifier", () => {
    const result = resolveCreditor(input({ candidates: [officialCandidate({ matchedField: "name", matchedValue: "Pessoa Exemplo", officialRoleConfirmed: false })] }));
    expect(result.state).toBe("POSSÍVEL_CORRESPONDÊNCIA");
    expect(result.confidence).toBe("BAIXA");
  });

  it("keeps an author at the origin process as partial, not a confirmed creditor", () => {
    const result = resolveCreditor(input({ candidates: [officialCandidate({ role: "AUTOR", matchedField: "originProcessNumber", matchedValue: identifiers.originProcessNumber })] }));
    expect(result.state).toBe("CREDOR_PARCIALMENTE_IDENTIFICADO");
    expect(result.currentHolderStatus).toBe("CURRENT_HOLDER_NOT_CONFIRMED");
  });

  it("flags conflicting explicitly labeled creditors for the same DEPRE", () => {
    const result = resolveCreditor(input({ candidates: [officialCandidate(), officialCandidate({ displayName: "Outra Pessoa" })] }));
    expect(result.state).toBe("CONFLITO_DE_IDENTIDADE");
    expect(result.selectedCandidate).toBeNull();
  });

  it("corroborates the same exact creditor from an independent source", () => {
    const first = officialCandidate({ sourceUrl: "https://www.tjsp.jus.br/source-a" });
    const second = officialCandidate({ sourceUrl: "https://www.tjsp.jus.br/source-b" });
    const result = resolveCreditor(input({ candidates: [second], previousCandidates: [first] }));
    expect(result.state).toBe("CREDOR_CORROBORADO");
  });

  it("records zero results without claiming that no creditor exists", () => {
    const result = resolveCreditor(input({ queryState: "RESULT_ZERO", resultCount: 0, candidates: [] }));
    expect(result.state).toBe("CREDOR_NÃO_IDENTIFICADO");
    expect(result.explanation).toContain("não prova ausência");
  });

  it("preserves unavailable and CAPTCHA-assisted source states", () => {
    expect(resolveCreditor(input({ queryState: "ACCESS_FAILED", resultCount: 0, candidates: [] })).state).toBe("FONTE_INDISPONÍVEL");
    expect(resolveCreditor(input({ queryState: "REQUIRES_ASSISTED_ACTION", resultCount: 0, candidates: [] })).state).toBe("REVISÃO_HUMANA");
  });

  it("resolves two distinct DEPRE official documents and de-dupes repeated URLs", () => {
    const result = resolveOfficialDocuments({
      numeroProcessoDEPRE: identifiers.numeroProcessoDEPRE,
      debtor: identifiers.debtor,
      tribunal: "TJSP",
      documents: [
        {
          documentType: "Ofício Requisitório-Precatório Expedido",
          documentDate: "2024-01-15",
          numeroProcessoDEPRE: identifiers.numeroProcessoDEPRE,
          officialSource: "TJSP / e-SAJ",
          consultationUrl: "https://www.tjsp.jus.br/Precatorios/ConsultaRequisitorios",
          documentUrl: "https://www.tjsp.jus.br/Precatorios/Documentos/oficio-1.pdf",
          accessStatus: "PUBLIC",
          sourceReference: "oficio-1",
          evidenceId: "doc-1",
          confidence: 0.96,
        },
        {
          documentType: "DEPRE - Ofício de Processamento Expedido",
          documentDate: "2024-01-20",
          numeroProcessoDEPRE: identifiers.numeroProcessoDEPRE,
          officialSource: "TJSP / DEPRE",
          consultationUrl: "https://www.tjsp.jus.br/Precatorios/ConsultaRequisitorios",
          documentUrl: "https://www.tjsp.jus.br/Precatorios/Documentos/oficio-1.pdf",
          accessStatus: "PUBLIC",
          sourceReference: "oficio-1-copy",
          evidenceId: "doc-1-duplicate",
          confidence: 0.96,
        },
        {
          documentType: "Ofício - Processamento - DEPRE",
          documentDate: "2024-01-21",
          numeroProcessoDEPRE: identifiers.numeroProcessoDEPRE,
          officialSource: "TJSP / DEPRE",
          consultationUrl: "https://www.tjsp.jus.br/Precatorios/ConsultaRequisitorios",
          documentUrl: "https://www.tjsp.jus.br/Precatorios/Documentos/oficio-2.pdf",
          accessStatus: "PUBLIC",
          sourceReference: "oficio-2",
          evidenceId: "doc-2",
          confidence: 0.97,
        },
      ],
    });

    expect(result.documentationOficios.status).toBe("2/2");
    expect(result.documentationOficios.documents).toHaveLength(2);
    expect(result.officialDocumentUrls).toHaveLength(2);
  });

  it("keeps attorney contacts separate from the creditor and allows beneficiary-only contact resolution", () => {
    const result = discoverBeneficiaryContacts({
      creditorName: "João da Silva",
      contactCandidates: [
        { type: "PHONE", value: "(11) 99999-9999", normalizedValue: "11999999999", source: "https://empresa.com.br/contato", sourceUrl: "https://empresa.com.br/contato", confidence: 0.93, publicSource: true, belongsTo: "CREDOR" },
        { type: "PHONE", value: "(11) 98888-8888", normalizedValue: "11988888888", source: "https://advogado.com.br/contato", sourceUrl: "https://advogado.com.br/contato", confidence: 0.9, publicSource: true, belongsTo: "ADVOGADO" },
      ],
    });

    expect(result.contacts.beneficiary).toHaveLength(1);
    expect(result.contacts.relatedProfessional).toHaveLength(1);
    expect(result.contacts.relatedProfessional[0].belongsTo).toBe("ADVOGADO");
    expect(result.contactSummary).toContain("João da Silva");
  });
});
