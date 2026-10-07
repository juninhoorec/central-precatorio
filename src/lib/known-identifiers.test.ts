/**
 * PHASE 7 — Tests for known-identifiers.ts (BLOCKER-7-02)
 */
import { describe, it, expect } from "vitest";
import {
  extractKnownIdentifiers,
  extractKnownIdentifiersCompat,
  toKnownIdentifiersCompat,
} from "./known-identifiers";

describe("known-identifiers", () => {
  describe("extractKnownIdentifiers", () => {
    it("extracts DEPRE from $.credit.numeroProcessoDEPRE", () => {
      const result = extractKnownIdentifiers({
        credit: { numeroProcessoDEPRE: "0001234-56.2024.8.26.0053" },
      });
      const depre = result.identifiers.find((i) => i.type === "DEPRE");
      expect(depre).toBeDefined();
      expect(depre!.normalizedValue).toBe("0001234-56.2024.8.26.0053");
      expect(depre!.sourcePath).toBe("$.credit.numeroProcessoDEPRE");
    });

    it("extracts PROCESSO_ORIGINARIO from $.credit.numeroProcessoOrigem", () => {
      const result = extractKnownIdentifiers({
        credit: { numeroProcessoOrigem: "9876543-21.2020.8.26.0100" },
      });
      const proc = result.identifiers.find((i) => i.type === "PROCESSO_ORIGINARIO");
      expect(proc).toBeDefined();
      expect(proc!.normalizedValue).toBe("9876543-21.2020.8.26.0100");
    });

    it("extracts PROCESSO_ORIGINARIO from legacy $.credit.originProcessNumber", () => {
      const result = extractKnownIdentifiers({
        credit: { originProcessNumber: "9876543-21.2020.8.26.0100" },
      });
      const proc = result.identifiers.find((i) => i.type === "PROCESSO_ORIGINARIO");
      expect(proc).toBeDefined();
      expect(proc!.sourcePath).toBe("$.credit.originProcessNumber");
    });

    it("deduplicates when both paths have the same value", () => {
      const result = extractKnownIdentifiers({
        credit: {
          numeroProcessoOrigem: "9876543-21.2020.8.26.0100",
          originProcessNumber: "9876543-21.2020.8.26.0100",
        },
      });
      const procs = result.identifiers.filter((i) => i.type === "PROCESSO_ORIGINARIO");
      expect(procs.length).toBe(1);
    });

    it("extracts EPES from $.credit.numeroEPES", () => {
      const result = extractKnownIdentifiers({
        credit: { numeroEPES: "EPES-2024-001" },
      });
      const epes = result.identifiers.find((i) => i.type === "EPES");
      expect(epes).toBeDefined();
      expect(epes!.normalizedValue).toBe("EPES-2024-001");
    });

    it("extracts TITULAR_NAME from $.titular.nomeBeneficiario", () => {
      const result = extractKnownIdentifiers({
        titular: { nomeBeneficiario: "Maria  Silva  Santos" },
      });
      const name = result.identifiers.find((i) => i.type === "TITULAR_NAME");
      expect(name).toBeDefined();
      // Whitespace is normalized
      expect(name!.normalizedValue).toBe("Maria Silva Santos");
      expect(name!.sourcePath).toBe("$.titular.nomeBeneficiario");
    });

    it("extracts TITULAR_NAME from legacy $.client.name", () => {
      const result = extractKnownIdentifiers({
        client: { name: "João Pereira" },
      });
      const name = result.identifiers.find((i) => i.type === "TITULAR_NAME");
      expect(name).toBeDefined();
      expect(name!.sourcePath).toBe("$.client.name");
    });

    it("handles null, empty, and sentinel values as absent", () => {
      const result = extractKnownIdentifiers({
        credit: {
          numeroProcessoDEPRE: null,
          numeroProcessoOrigem: "",
          epesNumber: "null",
          numeroEPES: "undefined",
        },
        titular: { nomeBeneficiario: "n/a" },
      });
      expect(result.identifiers.length).toBe(0);
      expect(result.absentFields.length).toBeGreaterThanOrEqual(4);
    });

    it("rejects malformed CNJ process numbers", () => {
      const result = extractKnownIdentifiers({
        credit: { numeroProcessoDEPRE: "123" },
      });
      const depre = result.identifiers.find((i) => i.type === "DEPRE");
      expect(depre).toBeUndefined();
      const absent = result.absentFields.find((a) => a.path === "$.credit.numeroProcessoDEPRE");
      expect(absent?.reason).toBe("MALFORMED");
    });

    it("normalizes raw 20-digit process numbers to CNJ format", () => {
      // Raw digits: 0001234562024826 0053  → 0001234-56.2024.8.26.0053
      const result = extractKnownIdentifiers({
        credit: { numeroProcessoDEPRE: "00012345620248260053" },
      });
      const depre = result.identifiers.find((i) => i.type === "DEPRE");
      expect(depre).toBeDefined();
      expect(depre!.normalizedValue).toBe("0001234-56.2024.8.26.0053");
    });

    it("handles string-encoded workflow JSON", () => {
      const json = JSON.stringify({
        credit: { numeroProcessoDEPRE: "0001234-56.2024.8.26.0053" },
        client: { name: "Test Person" },
      });
      const result = extractKnownIdentifiers(json);
      expect(result.identifiers.length).toBe(2);
    });

    it("handles completely empty or malformed workflow gracefully", () => {
      expect(extractKnownIdentifiers(null).identifiers.length).toBe(0);
      expect(extractKnownIdentifiers(undefined).identifiers.length).toBe(0);
      expect(extractKnownIdentifiers("not json").identifiers.length).toBe(0);
      expect(extractKnownIdentifiers(42).identifiers.length).toBe(0);
    });

    it("extracts full workflow with all fields", () => {
      const result = extractKnownIdentifiers({
        credit: {
          numeroProcessoDEPRE: "0001234-56.2024.8.26.0053",
          numeroProcessoOrigem: "9876543-21.2020.8.26.0100",
          numeroEPES: "EPES-2024-001",
        },
        titular: { nomeBeneficiario: "Maria Silva" },
      });
      expect(result.identifiers.length).toBe(4);
      const types = result.identifiers.map((i) => i.type);
      expect(types).toContain("DEPRE");
      expect(types).toContain("PROCESSO_ORIGINARIO");
      expect(types).toContain("EPES");
      expect(types).toContain("TITULAR_NAME");
    });
  });

  describe("toKnownIdentifiersCompat", () => {
    it("converts to compat format without DEPRE", () => {
      const result = extractKnownIdentifiers({
        credit: {
          numeroProcessoDEPRE: "0001234-56.2024.8.26.0053",
          numeroProcessoOrigem: "9876543-21.2020.8.26.0100",
          numeroEPES: "EPES-2024-001",
        },
        titular: { nomeBeneficiario: "Maria Silva" },
      });
      const compat = toKnownIdentifiersCompat(result);

      // DEPRE is NOT in compat — it is passed separately
      expect(compat.originProcessNumber).toBe("9876543-21.2020.8.26.0100");
      expect(compat.epesNumber).toBe("EPES-2024-001");
      expect(compat.beneficiaryCandidateName).toBe("Maria Silva");
    });

    it("returns undefined for missing fields", () => {
      const compat = toKnownIdentifiersCompat(extractKnownIdentifiers({}));
      expect(compat.originProcessNumber).toBeUndefined();
      expect(compat.epesNumber).toBeUndefined();
      expect(compat.beneficiaryCandidateName).toBeUndefined();
    });
  });

  describe("extractKnownIdentifiersCompat", () => {
    it("is a convenience wrapper", () => {
      const compat = extractKnownIdentifiersCompat({
        credit: { originProcessNumber: "9876543-21.2020.8.26.0100" },
        client: { name: "Test" },
      });
      expect(compat.originProcessNumber).toBe("9876543-21.2020.8.26.0100");
      expect(compat.beneficiaryCandidateName).toBe("Test");
    });
  });
});
