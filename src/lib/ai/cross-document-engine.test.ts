import { describe, expect, it } from "vitest";
import type { Operation } from "@/lib/operations";
import { buildCrossDocumentContext } from "./cross-document-engine";

const operation = { id: "operation-1" } as Pick<Operation, "id"> as Operation;

function document(id: string, text: string, name = id) {
  return { id, name, createdAt: "2026-09-28T12:00:00.000Z", textPages: [text] };
}

describe("Cross-document evidence reconciliation", () => {
  it("links documents only when an exact canonical identifier matches", () => {
    const result = buildCrossDocumentContext(operation, [
      document("a", "Processo DEPRE nº 0032722-57.2014.8.26.0500.", "same.pdf"),
      document("b", "Processo DEPRE nº 0032722-57.2014.8.26.0500.", "different.pdf")
    ]);

    expect(result.relations).toHaveLength(1);
    expect(result.relations[0].relationType).toBe("SAME_PRECATORY");
    expect(result.relations[0].evidenceItems.map(item => item.documentId)).toEqual(["a", "b"]);
    expect(result.relations[0].evidenceItems.every(item => item.page === 1 && item.textSpan.length > 0)).toBe(true);
  });

  it("does not infer a relation from similar filenames", () => {
    const result = buildCrossDocumentContext(operation, [
      document("a", "Documento sem identificador.", "processo-0032722.pdf"),
      document("b", "Outro documento sem identificador.", "processo-0032722-atualizado.pdf")
    ]);

    expect(result.relations).toEqual([]);
  });

  it("preserves source conflicts without selecting a winner", () => {
    const result = buildCrossDocumentContext(operation, [
      document("a", "Processo DEPRE nº 0032722-57.2014.8.26.0500. Valor atualizado: R$ 218.088,90."),
      document("b", "Processo DEPRE nº 0032722-57.2014.8.26.0500. Valor atualizado: R$ 219.101,22.")
    ]);

    expect(result.sourceMatrix.find(row => row.field === "Valor")?.status).toBe("CONFLICT");
    expect(result.sourceMatrix.find(row => row.field === "Valor")?.values).toHaveLength(2);
    expect(result.conflicts.some(row => row.field === "Valor")).toBe(true);
  });

  it("keeps attorney and creditor roles distinct even on the same page", () => {
    const result = buildCrossDocumentContext(operation, [
      document("a", "Beneficiário titular: João da Silva. Advogado: Carlos de Souza OAB/SP 12345.")
    ]);

    expect(result.partyMatrix).toContainEqual(expect.objectContaining({ name: "Carlos de Souza OAB/SP 12345", role: "ADVOGADO" }));
    expect(result.partyMatrix).not.toContainEqual(expect.objectContaining({ name: "Carlos de Souza OAB/SP 12345", role: "CREDOR" }));
  });

  it("treats cession and succession mentions as hypotheses, not confirmed holder changes", () => {
    const result = buildCrossDocumentContext(operation, [
      document("a", "Há instrumento de cessão de crédito mencionado. Possível sucessão e habilitação de herdeiros.")
    ]);

    expect(result.cessionState).toBe("POSSIBLE_CESSION");
    expect(result.successionState).toBe("POSSIBLE_SUCCESSION");
    expect(result.currentHolderState).toBe("POSSIBLE_TRANSFER");
    expect(result.currentHolderState).not.toBe("CURRENT_HOLDER_CONFIRMED");
  });

  it("marks an explicitly identified cession document without declaring its legal effect", () => {
    const result = buildCrossDocumentContext(operation, [
      document("a", "Instrumento de cessão de crédito. Cedente: João Silva. Cessionário: Maria Souza.")
    ]);

    expect(result.cessionState).toBe("CESSION_DOCUMENT_FOUND");
    expect(result.currentHolderState).toBe("POSSIBLE_TRANSFER");
  });

  it("reports page-level analysis coverage", () => {
    const result = buildCrossDocumentContext(operation, [
      { ...document("a", "Página um."), textPages: ["Página um.", "Página dois."] }
    ]);

    expect(result.coverage).toMatchObject({ documentsAnalyzed: 1, pagesAnalyzed: 2, partial: false });
  });
});
