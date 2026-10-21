import fs from 'node:fs';
import readline from 'node:readline';
import { createOperation, listOperations } from '../src/lib/operations.ts';
import { createDefaultWorkflow } from '../src/lib/operational-workflow.ts';

const limit = Number(process.env.CP_IMPORT_LIMIT || 1000);
const org = process.env.CP_IMPORT_ORGANIZATION_ID || 'legacy-internal';
const actor = process.env.CP_IMPORT_ACTOR || 'import-reconciled-batch';
const source = 'CP · fila geral reconciliada · lote sem conflito';
const normalize = (v: string) => v.replace(/\D/g, '');
const conflicts = new Set<string>();
for await (const line of readline.createInterface({ input: fs.createReadStream('data/reconciliation-staging/candidates-conflict-review.jsonl'), crlfDelay: Infinity })) if (line.trim()) conflicts.add(JSON.parse(line).depreKey);
const existing = new Map((await listOperations(undefined, org)).map((o) => [normalize(o.workflow.credit.numeroProcessoDEPRE || ''), o.id] as const).filter(([k]) => k));
const queue = JSON.parse(fs.readFileSync('data/queue-100k-document-priority.json','utf8')) as Array<Record<string, unknown>>;
let created=0, skipped=0, rejected=0; const errors: unknown[]=[];
for (const row of queue) {
  if (created >= limit) break;
  const depre=String(row.depre||'').trim(), key=normalize(depre); if (!depre || conflicts.has(key) || existing.has(key)) { skipped++; continue; }
  const amount=Number(row.valor_max||0); if (!amount || amount < 100000) { rejected++; continue; }
  try {
    const wf=createDefaultWorkflow(amount); wf.credit.numeroProcessoDEPRE=depre; wf.credit.numeroProcessoDEPRENormalizado=key; wf.credit.originProcessNumber=String(row.processo_origem||''); wf.credit.grossAmount=amount; wf.credit.municipality=String(row.devedora||''); wf.credit.debtorState='SP'; wf.credit.issuingCourt='TJSP'; wf.credit.sourceName=source; wf.credit.sourceUrl='fila_pesquisa.csv'; wf.queryStatus='PARTIAL'; wf.documentStatus='MISSING'; wf.creditorResolution={state:'PENDENTE',confidence:'BAIXA',currentHolderStatus:'CURRENT_HOLDER_NOT_CONFIRMED',identifiedName:'',explanation:'Candidato importado da fila geral sem titularidade/CPF confirmado.',nextAction:'Pesquisar titular, CPF/CNPJ e documentos oficiais.',updatedAt:new Date().toISOString()};
    const op=await createOperation({title:`Candidato DEPRE ${depre}`,debtor:String(row.devedora||'TJSP'),tribunal:'TJSP',process:String(row.processo_origem||''),owner:'',source,stage:'Entrada',nominal:amount,notes:'Fila geral reconciliada. Aguardando pesquisa manual do titular, CPF/CNPJ e documentos.',tasks:[],checks:[],proposals:[],workflow:wf,isDemo:false},undefined,org,actor); existing.set(key,op.id); created++;
  } catch(e){errors.push({depre,error:String(e)});}
}
console.log(JSON.stringify({limit,created,skipped,rejected,errors:errors.length,organization:org},null,2));
