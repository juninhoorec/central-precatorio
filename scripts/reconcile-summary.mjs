import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";

const download = "C:/Users/Junio Cavalcanti/Downloads";
const out = path.resolve("evidence/reconciliation-20261009");
const files = ["CP_pacote_completo_73_DEPREs.xlsx", "DEPRE_consolidado_recuperado_completo.xlsx", "DEPRE_73_contatos_pesquisados.xlsx", "fila_piloto_campinas_guarulhos.csv", "CP_CAC_PESQUISA_907_CANDIDATOS.csv", "fila_pesquisa.csv", "fila_pesquisa.jsonl", "registros_completos.csv"];
const pattern = /\d{7}-\d{2}\.\d{4}\.8\.26\.\d{4}/g;
const sets = new Map();
for (const file of files) {
  const full = path.join(download, file);
  let text = "";
  if (file.endsWith(".xlsx")) {
    const workbook = XLSX.readFile(full, { cellDates: false });
    text = workbook.SheetNames.flatMap((sheet) => XLSX.utils.sheet_to_json(workbook.Sheets[sheet], { header: 1, defval: "" }).map((row) => row.join(" | "))).join("\n");
  } else text = fs.readFileSync(full, "utf8");
  sets.set(file, new Set(text.match(pattern) ?? []));
}
const summary = { files: files.map((file) => ({ file, uniqueDepres: sets.get(file).size, bytes: fs.statSync(path.join(download, file)).size })), intersections: [], differencesAgainstPackage: [] };
for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) summary.intersections.push({ sourceA: files[i], sourceB: files[j], uniqueIntersection: [...sets.get(files[i])].filter((id) => sets.get(files[j]).has(id)).length });
const base = sets.get("CP_pacote_completo_73_DEPREs.xlsx");
for (const file of files) if (file !== files[0]) summary.differencesAgainstPackage.push({ file, onlyInFile: [...sets.get(file)].filter((id) => !base.has(id)).length, sharedWithPackage: [...sets.get(file)].filter((id) => base.has(id)).length });
fs.writeFileSync(path.join(out, "source-reconciliation-summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, "source-reconciliation-summary.md"), `# Reconciliação das fontes DEPRE\n\n## Contagens\n\n| Fonte | Bytes | DEPREs únicos |\n|---|---:|---:|\n${summary.files.map((x) => `| ${x.file} | ${x.bytes} | ${x.uniqueDepres} |`).join("\n")}\n\n## Diferenças contra o pacote-base\n\n| Fonte | Compartilhados | Somente na fonte |\n|---|---:|---:|\n${summary.differencesAgainstPackage.map((x) => `| ${x.file} | ${x.sharedWithPackage} | ${x.onlyInFile} |`).join("\n")}\n\nA interseção detalhada entre todos os pares está em \`source-reconciliation-summary.json\`. Os arquivos de origem permanecem inalterados.\n`);
console.log(JSON.stringify(summary, null, 2));
