import fs from 'node:fs';
import readline from 'node:readline';
import path from 'node:path';

const input = path.resolve('evidence/reconciliation-20261009/depre-master.jsonl');
const outDir = path.resolve('data/reconciliation-staging');
fs.mkdirSync(outDir, { recursive: true });
const clean = fs.createWriteStream(path.join(outDir, 'candidates-no-conflict.jsonl'), { encoding: 'utf8' });
const conflicts = fs.createWriteStream(path.join(outDir, 'candidates-conflict-review.jsonl'), { encoding: 'utf8' });
let total=0, cleanCount=0, conflictCount=0, existingCount=0;
const rl = readline.createInterface({ input: fs.createReadStream(input), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line.trim()) continue;
  const row=JSON.parse(line); total++;
  if (row.classification === 'EXISTING_OPERATION') { existingCount++; continue; }
  if (row.classification === 'ENTITY_CONFLICT' || row.conflict) { conflicts.write(`${line}\n`); conflictCount++; }
  else { clean.write(`${line}\n`); cleanCount++; }
}
await Promise.all([new Promise(r=>clean.end(r)), new Promise(r=>conflicts.end(r))]);
const report={generatedAt:new Date().toISOString(),totalMaster:total,existingOperationsSkipped:existingCount,noConflictCandidates:cleanCount,conflictReviewCandidates:conflictCount,policy:'Nenhuma operação criada nesta etapa; candidatos sem conflito foram apenas preparados para importação.'};
fs.writeFileSync(path.join(outDir,'staging-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
