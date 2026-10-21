import fs from "node:fs/promises";
import nodeFs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import XLSX from "xlsx";
import { createClient } from "@libsql/client";

const downloads = "C:/Users/Junio Cavalcanti/Downloads";
const outputDir = path.resolve("evidence/reconciliation-20261009");
const dbPath = path.resolve("central-precatorios.db");
const sources = [
  "CP_pacote_completo_73_DEPREs.xlsx",
  "DEPRE_consolidado_recuperado_completo.xlsx",
  "DEPRE_73_contatos_pesquisados.xlsx",
  "fila_piloto_campinas_guarulhos.csv",
  "CP_CAC_PESQUISA_907_CANDIDATOS.csv",
  "fila_pesquisa.csv",
  "fila_pesquisa.jsonl",
  "registros_completos.csv",
] as const;
const deprePattern = /\b\d{7}-\d{2}\.\d{4}\.8\.26\.\d{4}\b/g;
const normalize = (value: string) => value.replace(/\D/g, "");
const clean = (value: unknown) => String(value ?? "").trim();
type Occurrence = { sourceFile: string; sheet: string; rowNumber: number; depreOriginal: string; depreKey: string; raw: Record<string, unknown>; identifiersInRow: string[] };

function parseCsvRow(sourceFile: string, rowNumber: number, headers: string[], values: unknown[]): Occurrence[] {
  const raw: Record<string, unknown> = {};
  headers.forEach((header, index) => { raw[header || `column_${index + 1}`] = values[index] ?? ""; });
  const text = values.map(clean).join(" | ");
  const identifiers = [...new Set(text.match(deprePattern) ?? [])];
  return identifiers.map((depreOriginal) => ({ sourceFile, sheet: "", rowNumber, depreOriginal, depreKey: normalize(depreOriginal), raw, identifiersInRow: identifiers }));
}

async function readSource(sourceFile: string): Promise<Occurrence[]> {
  const fullPath = path.join(downloads, sourceFile);
  try { await fs.access(fullPath); } catch { return []; }
  if (sourceFile.endsWith(".xlsx")) {
    const workbook = XLSX.read(await fs.readFile(fullPath), { type: "buffer", cellDates: false });
    const out: Occurrence[] = [];
    for (const sheet of workbook.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[sheet], { header: 1, defval: "", raw: false });
      const headers = (rows.shift() ?? []).map((value, index) => clean(value) || `column_${index + 1}`);
      rows.forEach((values, index) => out.push(...parseCsvRow(sourceFile, index + 2, headers, values)));
    }
    return out.map((row) => ({ ...row, sheet: row.sheet || "" }));
  }
  const text = await fs.readFile(fullPath, "utf8");
  if (sourceFile.endsWith(".jsonl")) {
    return text.split(/\r?\n/).flatMap((line, index) => {
      if (!line.trim()) return [];
      let raw: Record<string, unknown>;
      try { raw = JSON.parse(line) as Record<string, unknown>; } catch { raw = { rawLine: line, parseError: true }; }
      return parseCsvRow(sourceFile, index + 1, Object.keys(raw), Object.values(raw));
    });
  }
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
  return parsed.data.flatMap((row, index) => parseCsvRow(sourceFile, index + 2, Object.keys(row), Object.values(row)));
}

function fieldValues(rows: Occurrence[], names: RegExp): string[] {
  return [...new Set(rows.flatMap((row) => Object.entries(row.raw).filter(([key]) => names.test(key)).map(([, value]) => clean(value)).filter(Boolean)))];
}

await fs.mkdir(outputDir, { recursive: true });
const allRows = (await Promise.all(sources.map(readSource))).flat();
const byKey = new Map<string, Occurrence[]>();
for (const row of allRows) byKey.set(row.depreKey, [...(byKey.get(row.depreKey) ?? []), row]);

const db = createClient({ url: `file:${dbPath.replaceAll("\\", "/")}` });
const operationRows = await db.execute("SELECT id, organization_id, source, is_demo, workflow FROM operations");
const existing = new Map<string, { id: string; organizationId: string; source: string; isDemo: number }>();
for (const row of operationRows.rows) {
  try {
    const workflow = JSON.parse(String(row.workflow)) as { credit?: { numeroProcessoDEPRE?: string } };
    const depre = workflow.credit?.numeroProcessoDEPRE;
    if (depre) existing.set(normalize(depre), { id: String(row.id), organizationId: String(row.organization_id), source: String(row.source), isDemo: Number(row.is_demo) });
  } catch { /* preserve unreadable operation outside the reconciliation key */ }
}
const counts = {
  operations: operationRows.rows.length,
  evidence: Number((await db.execute("SELECT COUNT(*) n FROM official_evidence_documents")).rows[0]?.n ?? 0),
  audit: Number((await db.execute("SELECT COUNT(*) n FROM audit_logs")).rows[0]?.n ?? 0),
};
await db.close();

const sourceStats = sources.map((sourceFile) => {
  const rows = allRows.filter((row) => row.sourceFile === sourceFile);
  return { sourceFile, rowsRead: sourceFile.endsWith(".xlsx") ? rows.length : rows.length, uniqueDepres: new Set(rows.map((row) => row.depreKey)).size, found: Boolean(rows.length) };
});
const master = [...byKey.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([depreKey, rows]) => {
  const originals = [...new Set(rows.map((row) => row.depreOriginal))];
  const municipalities = fieldValues(rows, /munic|devedora|debtor/i);
  const debtors = fieldValues(rows, /devedora|debtor|ente/i);
  const processOrigins = fieldValues(rows, /processo[_ ]?origem|originProcess|processo origin/i);
  const conflict = municipalities.length > 1 || debtors.length > 1 || originals.length > 1;
  const operation = existing.get(depreKey);
  const classification = operation ? "EXISTING_OPERATION" : conflict ? "ENTITY_CONFLICT" : "NEW_CANDIDATE";
  return { depreKey, depreOriginals: originals, classification, operationId: operation?.id ?? "", sourceCount: new Set(rows.map((row) => row.sourceFile)).size, occurrenceCount: rows.length, municipalities, debtors, processOrigins, conflict, nextAction: operation ? "Preservar operação; usar novas linhas apenas para enriquecimento documentado." : conflict ? "Revisão manual de município/devedor antes de qualquer promoção." : "Pesquisa documental oficial e validação de duplicidade antes de criar operação." };
});
const correspondence = allRows.map((row) => ({ sourceFile: row.sourceFile, sheet: row.sheet, rowNumber: row.rowNumber, depreOriginal: row.depreOriginal, depreKey: row.depreKey, identifiersInRow: row.identifiersInRow, raw: row.raw }));
const conflicts = master.filter((row) => row.conflict || row.depreOriginals.length > 1 || row.classification === "ENTITY_CONFLICT");
const intersections = sources.map((sourceFile) => ({ sourceFile, uniqueDepres: new Set(allRows.filter((row) => row.sourceFile === sourceFile).map((row) => row.depreKey)) })).flatMap((left, index, list) => list.slice(index + 1).map((right) => ({ sourceA: left.sourceFile, sourceB: right.sourceFile, intersection: [...left.uniqueDepres].filter((key) => right.uniqueDepres.has(key)).length })));
const summary = { generatedAt: new Date().toISOString(), inputDirectory: downloads, sourceStats, databaseSnapshot: { path: dbPath, ...counts }, totalOccurrences: allRows.length, totalUniqueDepres: master.length, existingOperations: master.filter((row) => row.classification === "EXISTING_OPERATION").length, newCandidates: master.filter((row) => row.classification === "NEW_CANDIDATE").length, entityConflicts: conflicts.length, identifierReview: master.filter((row) => row.depreOriginals.length > 1).length, sourceReview: master.filter((row) => row.occurrenceCount === 0).length, rowsWithMultipleIdentifiers: allRows.filter((row) => row.identifiersInRow.length > 1).length, intersections };

await fs.writeFile(path.join(outputDir, "depre-master.jsonl"), master.map((row) => JSON.stringify(row)).join("\n") + "\n");
const correspondencePath = path.join(outputDir, "depre-correspondence.jsonl");
await new Promise<void>((resolve, reject) => {
  const stream = nodeFs.createWriteStream(correspondencePath, { encoding: "utf8" });
  stream.on("error", reject);
  stream.on("finish", resolve);
  for (const row of correspondence) stream.write(`${JSON.stringify(row)}\n`);
  stream.end();
});
await fs.writeFile(path.join(outputDir, "depre-conflicts.json"), JSON.stringify(conflicts, null, 2));
await fs.writeFile(path.join(outputDir, "depre-intersections.json"), JSON.stringify(intersections, null, 2));
await fs.writeFile(path.join(outputDir, "reconciliation-summary.json"), JSON.stringify(summary, null, 2));
await fs.writeFile(path.join(outputDir, "README.md"), `# Reconciliação mestre DEPRE\n\nGerado em ${summary.generatedAt}. Os arquivos de origem foram somente lidos. Nenhuma operação foi criada, alterada ou importada.\n\n## Critérios\n\n- A chave de comparação remove pontuação somente para localizar correspondências; o identificador original permanece preservado.\n- Cada ocorrência mantém arquivo, planilha, linha e payload original.\n- Linhas com múltiplos identificadores são marcadas em \`identifiersInRow\`; não há escolha silenciosa de um identificador.\n- Linhas repetidas não são descartadas: podem representar documentos, ordens ou eventos distintos.\n- \`NEW_CANDIDATE\` não significa oportunidade validada.\n- Nenhuma entrada foi promovida a operação, \`VALIDATED\` ou \`READY_FOR_ANALYST\`.\n\n## Snapshot\n\n- Operações lidas: ${counts.operations}\n- Evidências lidas: ${counts.evidence}\n- Eventos de auditoria lidos: ${counts.audit}\n- Ocorrências DEPRE: ${summary.totalOccurrences}\n- DEPREs únicos: ${summary.totalUniqueDepres}\n- Operações existentes reconhecidas: ${summary.existingOperations}\n- Novos candidatos para pesquisa: ${summary.newCandidates}\n- Conflitos de entidade: ${summary.entityConflicts}\n- Linhas com múltiplos identificadores: ${summary.rowsWithMultipleIdentifiers}\n\nDetalhes completos estão em \`depre-master.jsonl\`, \`depre-correspondence.jsonl\`, \`depre-conflicts.json\` e \`depre-intersections.json\`.\n`);
console.log(JSON.stringify({ outputDir, ...summary }, null, 2));
