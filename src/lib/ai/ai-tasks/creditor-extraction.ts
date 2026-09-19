import { z } from "zod";
import { generateStructured } from "../ollama-provider";
import type { AITaskDefinition } from "../ai-core";

export const creditorExtractionOutputSchema = z.object({
  candidates: z.array(z.object({
    name: z.string(),
    role: z.enum(["CREDOR", "BENEFICIARIO", "AUTOR", "ADVOGADO", "DEVEDOR", "HERDEIRO", "CESSIONARIO", "TERCEIRO", "DESCONHECIDO"]),
    evidenceText: z.string(),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  })),
  uncertainties: z.array(z.string()),
  warnings: z.array(z.string())
});

export type CreditorExtractionInput = {
  documentText: string;
  depre: string;
  originProcess: string;
};

export type CreditorExtractionOutput = z.infer<typeof creditorExtractionOutputSchema>;

export const creditorExtractionTask: AITaskDefinition<CreditorExtractionInput, CreditorExtractionOutput> = {
  name: "CREDITOR_CANDIDATE_EXTRACTION",
  promptVersion: "v1",
  schemaVersion: "v1",
  schema: creditorExtractionOutputSchema,
  policy: {
    evidenceRequired: true,
    humanReviewRequired: true,
    canonicalWriteAllowed: false // AI never writes to canonical
  },
  execute: async (input: CreditorExtractionInput) => {
    const prompt = `Analise o texto a seguir referente a um precatório.
DEPRE: ${input.depre}
Processo Origem: ${input.originProcess}

Identifique as partes envolvidas e seus papéis. 
NUNCA classifique um "ADVOGADO" como "CREDOR" a menos que haja evidência explícita.
Se a informação não estiver clara, marque o papel como "DESCONHECIDO".

Texto do documento:
${input.documentText.slice(0, 4000)} // Limiting chunk size for this example

Responda SOMENTE com um objeto JSON válido, aderindo ao schema.
`;
    return await generateStructured(prompt, creditorExtractionOutputSchema, "Você é um assistente de extração estruturada de dados jurídicos.");
  }
};
