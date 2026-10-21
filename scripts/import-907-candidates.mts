import fs from "node:fs";
import path from "node:path";
import { createOperation, listOperations } from "../src/lib/operations.ts";
import { createDefaultWorkflow } from "../src/lib/operational-workflow.ts";
import { beginImport, finishImport, recordImportSourceRow } from "../src/lib/capture-imports.ts";

type Candidate = {
  id: string;
  depre: string;
  titular: string;
  cpfCnpj: string;
  valor: number;
  municipio: string;
  devedor: string;
  processoOrigem: string;
  advogadoNome: string;
  advogadoOab: string;
  advogadoContato: string;
  oficio1Url: string;
  oficio2Url: string;
  prioridade: number;
};

const organizationId = process.env.CP_IMPORT_ORGANIZATION_ID || "legacy-internal";
const actor = process.env.CP_IMPORT_ACTOR || "import-907-candidates";
const sourceName = "CP · fila consolidada de 907 candidatos";
const sourceFile = path.resolve("data/queue-907-consolidated-final.json");

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function isCandidate(value: unknown): value is Candidate {
  const item = value as Partial<Candidate>;
  return Boolean(item && typeof item.id === "string" && item.id.startsWith("CP-907-") && item.depre);
}

const all = JSON.parse(fs.readFileSync(sourceFile, "utf8")) as unknown[];
const candidates = all.filter(isCandidate);
if (candidates.length !== 907) throw new Error(`EXPECTED_907_CANDIDATES:${candidates.length}`);

const existing = await listOperations(undefined, organizationId);
const existingByDepre = new Map(
  existing
    .map((operation) => [digits(operation.workflow.credit.numeroProcessoDEPRE || ""), operation.id] as const)
    .filter(([depre]) => Boolean(depre)),
);

const sourceBytes = fs.readFileSync(sourceFile);
const batch = await beginImport({
  organizationId,
  userId: actor,
  sourceId: "cp-queue-907",
  sourceName,
  fileName: path.basename(sourceFile),
  sourceReference: sourceFile,
  bytes: sourceBytes,
});

let created = 0;
let skipped = 0;
const errors: Array<{ row: number; id: string; error: string }> = [];

for (const [index, candidate] of candidates.entries()) {
  const depreDigits = digits(candidate.depre);
  if (existingByDepre.has(depreDigits)) {
    skipped += 1;
    await recordImportSourceRow({
      organizationId,
      batchId: batch.batch.id,
      operationId: existingByDepre.get(depreDigits)!,
      rowNumber: index + 1,
      sourceReference: sourceFile,
      rawValues: candidate,
      normalizedValues: { candidateId: candidate.id, depre: candidate.depre, deduplicated: true },
    });
    continue;
  }

  try {
    const workflow = createDefaultWorkflow(Number(candidate.valor) || 0);
    workflow.client.name = candidate.titular || "";
    workflow.client.document = candidate.cpfCnpj || "";
    workflow.credit.numeroProcessoDEPRE = candidate.depre;
    workflow.credit.numeroProcessoDEPRENormalizado = depreDigits;
    workflow.credit.originProcessNumber = candidate.processoOrigem || "";
    workflow.credit.grossAmount = Number(candidate.valor) || 0;
    workflow.credit.municipality = candidate.municipio || "";
    workflow.credit.issuingCourt = "TJSP";
    workflow.credit.debtorState = "SP";
    workflow.credit.legalRepName = candidate.advogadoNome || "";
    workflow.credit.legalRepOab = candidate.advogadoOab || "";
    workflow.credit.sourceName = sourceName;
    workflow.credit.sourceUrl = sourceFile;
    workflow.credit.checkedAt = new Date().toISOString();
    workflow.queryStatus = "PARTIAL";
    workflow.documentStatus = "MISSING";
    workflow.creditorResolution = {
      state: "PENDENTE",
      confidence: "BAIXA",
      currentHolderStatus: "CURRENT_HOLDER_NOT_CONFIRMED",
      identifiedName: candidate.titular || "",
      explanation: "Dados importados da fila de candidatos; não constituem confirmação de titularidade.",
      nextAction: "Confirmar credor atual em fonte oficial e persistir evidência vinculada ao DEPRE.",
      updatedAt: new Date().toISOString(),
    };
    workflow.evidence = [{
      id: crypto.randomUUID(),
      source: sourceName,
      sourceType: "MANUAL",
      reference: sourceFile,
      retrievedAt: new Date().toISOString(),
      confidence: 50,
      status: "REVISÃO HUMANA NECESSÁRIA",
      notes: `Fila ${candidate.id}. Valor, município, DEPRE, processo e referências foram importados como pistas de pesquisa; não são prova oficial de titularidade ou de ofício.`,
    }];
    workflow.validations = [{
      id: crypto.randomUUID(),
      check: "Importação idempotente da fila 907",
      severity: "INFO",
      status: "PENDING",
      explanation: "Registro importado como candidato pendente; nenhum campo foi promovido a confirmado sem evidência oficial.",
    }];

    const operation = await createOperation({
      title: `Candidato DEPRE ${candidate.depre}`,
      debtor: candidate.devedor || candidate.municipio || "TJSP",
      tribunal: "TJSP",
      process: candidate.processoOrigem || "",
      owner: "",
      source: sourceName,
      stage: "Entrada",
      nominal: Number(candidate.valor) || 0,
      notes: "Importado da fila 907 como candidato. A qualificação exige titularidade e dois documentos oficiais distintos.",
      tasks: [],
      checks: [],
      proposals: [],
      workflow,
      isDemo: false,
    }, undefined, organizationId, actor);

    await recordImportSourceRow({
      organizationId,
      batchId: batch.batch.id,
      operationId: operation.id,
      rowNumber: index + 1,
      sourceReference: sourceFile,
      rawValues: candidate,
      normalizedValues: { candidateId: candidate.id, depre: candidate.depre, depreNormalized: depreDigits, importedAs: "PENDING" },
    });
    existingByDepre.set(depreDigits, operation.id);
    created += 1;
  } catch (error) {
    errors.push({ row: index + 1, id: candidate.id, error: error instanceof Error ? error.message : String(error) });
  }
}

await finishImport(batch.batch.id, organizationId, errors.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED", {
  read: candidates.length,
  created,
  updated: 0,
  duplicates: skipped,
  conflicts: 0,
  rpvs: 0,
  skipped,
  belowMinimum: candidates.filter((candidate) => Number(candidate.valor) < 100000).length,
  incomplete: candidates.filter((candidate) => !candidate.titular || !candidate.cpfCnpj || !candidate.oficio1Url || !candidate.oficio2Url).length,
  errors: errors.length,
}, errors);

console.log(JSON.stringify({ sourceFile, candidates: candidates.length, created, skipped, errors, batchId: batch.batch.id }, null, 2));
