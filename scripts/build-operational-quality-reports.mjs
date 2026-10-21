import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const queuePath = path.join(root, "data", "queue-100k-document-priority.json");
const queue = JSON.parse(fs.readFileSync(queuePath, "utf8"));
const normalize = (v) => String(v ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const digits = (v) => String(v ?? "").replace(/\D/g, "");
const quality = (r) => {
  const cpf = digits(r.cpfCnpj ?? r.document);
  const titular = String(r.titular ?? r.holder ?? "").trim();
  const lawyer = String(r.advogadoNome ?? r.advogados ?? "").trim();
  return {
    titular: Boolean(titular) && !/^Credor Titular DEPRE/i.test(titular),
    document: cpf.length === 11 || cpf.length === 14,
    value: Number(r.valor ?? r.valor_max ?? 0) >= 100000,
    municipality: Boolean(String(r.municipio ?? r.devedora ?? "").trim()),
    lawyer: Boolean(lawyer) && !/habilitado nos autos/i.test(lawyer),
    process: Boolean(String(r.processoOrigem ?? r.processo_origem ?? "").trim()),
    documents: Boolean(r.oficio1Url || r.oficio2Url || r.refs_pdf),
  };
};
const groups = new Map();
for (const r of queue) {
  const keys = [r.depre && `depre:${normalize(r.depre)}`, (r.processoOrigem ?? r.processo_origem) && `processo:${normalize(r.processoOrigem ?? r.processo_origem)}`].filter(Boolean);
  for (const key of keys) {
    const list = groups.get(key) ?? [];
    list.push(r.id);
    groups.set(key, list);
  }
}
const duplicateSuggestions = [...groups.entries()]
  .filter(([, ids]) => new Set(ids).size > 1)
  .map(([key, ids]) => ({ id: `DUP-${normalize(key).slice(0, 40)}`, key, recordIds: [...new Set(ids)], status: "SUGERIDO", requiresHumanApproval: true }));
const qualityRows = queue.map((r) => ({ id: r.id, municipio: r.municipio ?? r.devedora, quality: quality(r) }));
const qualitySummary = Object.fromEntries(Object.keys(qualityRows[0]?.quality ?? {}).map((key) => [key, qualityRows.filter((r) => !r.quality[key]).length]));
const out = path.join(root, "data");
fs.writeFileSync(path.join(out, "duplicate-suggestions.json"), JSON.stringify({ generatedAt: new Date().toISOString(), total: duplicateSuggestions.length, suggestions: duplicateSuggestions }, null, 2));
fs.writeFileSync(path.join(out, "data-quality-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), total: queue.length, missingOrInvalid: qualitySummary, rows: qualityRows }, null, 2));
console.log(JSON.stringify({ records: queue.length, duplicateSuggestions: duplicateSuggestions.length, qualitySummary }, null, 2));
