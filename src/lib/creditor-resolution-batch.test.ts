import { describe, expect, it } from "vitest";
import { processBatchResolution, type CreditorSourceStrategy, type BatchResolutionItem } from "./creditor-resolution-batch";
import { createClient } from "@libsql/client";
import { initializeCreditorResolution } from "./creditor-resolution";

const mockClient = createClient({ url: "file::memory:" });

const mockSource: CreditorSourceStrategy = {
  name: "TJSP/Mock",
  url: "https://www.tjsp.jus.br/mock",
  supportsDEPRE: true,
  supportsOriginProcess: true,
  async execute(item) {
    if (item.identifiers.numeroProcessoDEPRE === "0000000-00.0000.0.00.0000") {
      return {
        queryKind: "PROCESSO_DEPRE",
        queryValue: item.identifiers.numeroProcessoDEPRE,
        queryState: "RESULTS_FOUND",
        resultCount: 1,
        candidates: [{
          displayName: "João da Silva",
          debtorName: item.identifiers.debtor,
          personType: "PERSON",
          role: "BENEFICIÁRIO",
          maskedCpf: "***.123.456-**",
          matchedField: "numeroProcessoDEPRE",
          matchedValue: item.identifiers.numeroProcessoDEPRE,
          evidenceExcerpt: "Beneficiário mockado",
          source: "TJSP/Mock",
          sourceUrl: "https://www.tjsp.jus.br/mock",
          sourceReferenceDate: new Date().toISOString().split("T")[0],
          sourcePage: null,
          officialRoleConfirmed: true,
          currentHolderClaim: "CURRENT_HOLDER"
        }]
      };
    }
    return {
      queryKind: "PROCESSO_DEPRE",
      queryValue: item.identifiers.numeroProcessoDEPRE,
      queryState: "REQUIRES_ASSISTED_ACTION",
      resultCount: 0,
      candidates: []
    };
  }
};

describe("Batch Creditor Resolution", () => {
  it("processes a batch of records correctly and respects assisted action", async () => {
    await initializeCreditorResolution(mockClient);
    
    const items: BatchResolutionItem[] = [
      {
        operationId: crypto.randomUUID(),
        identifiers: {
          numeroProcessoDEPRE: "0000000-00.0000.0.00.0000",
          epes: "",
          originProcessNumber: "",
          precatoryNumber: "",
          debtor: "TESTE"
        }
      },
      {
        operationId: crypto.randomUUID(),
        identifiers: {
          numeroProcessoDEPRE: "1111111-11.1111.1.11.1111",
          epes: "",
          originProcessNumber: "",
          precatoryNumber: "",
          debtor: "TESTE 2"
        }
      }
    ];
    
    const job = await processBatchResolution(items, [mockSource], crypto.randomUUID(), "test-org", "test-user", mockClient);
    
    expect(job.totalRecords).toBe(2);
    expect(job.processedRecords).toBe(2);
    expect(job.metrics.identified).toBe(1);
    expect(job.metrics.assistedRequired).toBe(1);
    expect(job.status).toBe("COMPLETED");
  });
});
