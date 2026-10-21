import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';

const downloads = 'C:/Users/Junio Cavalcanti/Downloads';
const outDir = path.resolve('data');
const filaPath = path.join(downloads, 'fila_pesquisa.csv');
const xlsxPath = path.join(downloads, 'DEPRE_consolidado_recuperado_completo.xlsx');
const normalize = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
const parseCsv = (line) => { const out=[]; let cur='', quoted=false; for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'&&line[i+1]==='"'){cur+='"';i++;} else if(ch==='"'){quoted=!quoted;} else if(ch===','&&!quoted){out.push(cur);cur='';} else cur+=ch;} out.push(cur); return out; };
const lines = fs.readFileSync(filaPath, 'utf8').split(/\r?\n/).filter(Boolean);
const headers = parseCsv(lines.shift()).map((h) => h.replace(/^\uFEFF/, ''));
const fila = lines.map((line) => Object.fromEntries(parseCsv(line).map((v,i)=>[headers[i],v])));
const wb = XLSX.read(fs.readFileSync(xlsxPath));
const docs = new Map();
for (const sheet of wb.SheetNames) {
  for (const row of XLSX.utils.sheet_to_json(wb.Sheets[sheet], { defval: '' })) {
    const depre = row['DEPRE / Processo'];
    const document = row['CPF / CNPJ'];
    const holder = row['Titular / Beneficiário'] || row['Credor / Titular'];
    if (!depre || !document) continue;
    const key = normalize(depre);
    docs.set(key, { document: String(document).trim(), holder: String(holder || '').trim(), documentSource: `DEPRE_consolidado_recuperado_completo.xlsx · aba ${sheet}`, documentStatus: 'DISPONIVEL_PARA_CONFERENCIA' });
  }
}
const queue = fila.map((row, index) => {
  const match = docs.get(normalize(row.depre));
  return { id: `CP-100K-${String(index + 1).padStart(6, '0')}`, ...row, ...(match || { document: '', holder: '', documentSource: '', documentStatus: 'NAO_LOCALIZADO' }), priorityWithDocument: Boolean(match) ? 1 : 0 };
});
queue.sort((a,b) => b.priorityWithDocument - a.priorityWithDocument || Number(b.valor_max || 0) - Number(a.valor_max || 0));
const prioritized = queue.filter((r) => r.priorityWithDocument === 1);
const queueKeys = new Set(queue.map((r) => normalize(r.depre)));
const standaloneDocuments = [...docs.entries()].filter(([key]) => !queueKeys.has(key)).map(([depre, value], index) => ({
  id: `CP-DOCUMENT-${String(index + 1).padStart(4, '0')}`,
  depre,
  ...value,
  source: 'DEPRE_consolidado_recuperado_completo.xlsx',
  priorityWithDocument: 1,
  status: 'DOCUMENTO_DISPONIVEL_PARA_CONFERENCIA',
}));
const report = {
  generatedAt: new Date().toISOString(), sourceRows: fila.length, outputRows: queue.length,
  withDocument: prioritized.length, withoutDocument: queue.length - prioritized.length,
  byMunicipalityWithDocument: prioritized.reduce((a,r)=>{a[r.devedora]=(a[r.devedora]||0)+1;return a;},{}),
  standaloneDocumentRecords: standaloneDocuments.length,
  note: 'CPF/CNPJ vem de planilha de consolidação e deve ser conferido manualmente antes de proposta.'
};
fs.writeFileSync(path.join(outDir, 'queue-100k-document-priority.json'), JSON.stringify(queue, null, 2));
fs.writeFileSync(path.join(outDir, 'queue-100k-document-priority-report.json'), JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(outDir, 'queue-100k-with-document.json'), JSON.stringify(prioritized, null, 2));
fs.writeFileSync(path.join(outDir, 'document-candidates-from-consolidated.xlsx.json'), JSON.stringify([...prioritized, ...standaloneDocuments], null, 2));
console.log(JSON.stringify(report, null, 2));
