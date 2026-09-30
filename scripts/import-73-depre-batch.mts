import fs from 'node:fs';
import XLSX from 'xlsx';
import { createOperation, listOperations } from '../src/lib/operations.ts';
import { beginImport, finishImport, recordImportSourceRow } from '../src/lib/capture-imports.ts';
import { createDefaultWorkflow } from '../src/lib/operational-workflow.ts';

const workbookPath = new URL('../data/CP_pacote_completo_73_DEPREs.xlsx', import.meta.url);
const bytes = fs.readFileSync(workbookPath);
const workbook = XLSX.read(bytes, { type: 'array' });
const rows = XLSX.utils.sheet_to_json(workbook.Sheets['Contatos 73'], {
  header: 1,
  raw: false,
  blankrows: false,
  defval: '',
});
const rawData = (rows as any[]).slice(1).filter((row: any) => String(row?.[1] ?? '').trim());

const organizationId = 'legacy-internal';
const existing = await listOperations(undefined, organizationId);
const seen = new Set(
  existing
    .map((op) => String(op.workflow?.credit?.numeroProcessoDEPRENormalizado || '').replace(/\D/g, ''))
    .filter(Boolean),
);

const started = await beginImport({
  organizationId,
  userId: 'import-script',
  sourceId: 'tjsp-cac-assisted',
  sourceName: 'TJSP/DEPRE · Pacote 73',
  fileName: 'CP_pacote_completo_73_DEPREs.xlsx',
  sourceReference: workbookPath.pathname,
  bytes,
});

let created = 0;
let skipped = 0;

for (const [index, row] of rawData.entries()) {
  const municipio = String((row as any)[0] || '').trim();
  const depre = String((row as any)[1] || '').trim();
  const titular = String((row as any)[2] || '').trim();
  const statusContato = String((row as any)[3] || '').trim();
  const rotaContato = String((row as any)[4] || '').trim();
  const detalhe = String((row as any)[5] || '').trim();
  const fonteBusca = String((row as any)[6] || '').trim();

  if (!depre) {
    skipped += 1;
    continue;
  }

  const depreDigits = depre.replace(/\D/g, '');
  if (seen.has(depreDigits)) {
    skipped += 1;
    continue;
  }

  const workflow = createDefaultWorkflow(0);
  workflow.client.name = titular || 'Não informado';
  workflow.credit.numeroProcessoDEPRE = depre;
  workflow.credit.numeroProcessoDEPRENormalizado = depreDigits;
  workflow.credit.municipality = municipio || 'São Paulo';
  workflow.credit.issuingCourt = 'TJSP';
  workflow.credit.debtorState = 'SP';
  workflow.credit.sourceName = 'TJSP/DEPRE · Pacote 73';
  workflow.credit.sourceUrl = workbookPath.pathname;
  workflow.queryStatus = 'PARTIAL';
  workflow.documentStatus = 'INCOMPLETE';
  workflow.evidence = [{
    id: crypto.randomUUID(),
    source: 'CP_pacote_completo_73_DEPREs.xlsx',
    sourceType: 'MANUAL',
    reference: workbookPath.pathname,
    retrievedAt: new Date().toISOString(),
    confidence: 90,
    status: 'REVISÃO HUMANA NECESSÁRIA',
    notes: `Contatos 73 · sheet "Contatos 73". Município: ${municipio}. Status de contato: ${statusContato}. Rota/Contato público: ${rotaContato || 'não informado'}. Detalhe: ${detalhe || 'não informado'}. Fonte da busca: ${fonteBusca || 'não informado'}.`,
  }];
  workflow.validations = [{
    id: crypto.randomUUID(),
    check: 'DEPRE validado no pacote real',
    severity: 'INFO',
    status: 'PENDING',
    explanation: 'Registro importado diretamente do arquivo real CP_pacote_completo_73_DEPREs.xlsx e mantido sem substituição de dados existentes.',
  }];

  const operation = await createOperation(
    {
      title: `DEPRE ${depre}`,
      debtor: municipio || 'São Paulo',
      tribunal: 'TJSP',
      process: '',
      owner: '',
      source: 'TJSP/DEPRE · Pacote 73',
      stage: 'Entrada',
      nominal: 0,
      notes: `Importado do arquivo de base real "CP_pacote_completo_73_DEPREs.xlsx". Titular/credor: ${titular || 'não informado'}. Status de contato: ${statusContato || 'não informado'}. Rota/contato público: ${rotaContato || 'não informado'}. Observações: ${detalhe || 'não informado'}.`,
      tasks: [],
      checks: [],
      proposals: [],
      workflow,
      isDemo: false,
    },
    undefined,
    organizationId,
    'import-script',
  );

  await recordImportSourceRow({
    organizationId,
    batchId: started.batch.id,
    operationId: operation.id,
    rowNumber: index + 2,
    sourceReference: workbookPath.pathname,
    rawValues: { municipio, depre, titular, statusContato, rotaContato, detalhe, fonteBusca },
    normalizedValues: {
      creditor: titular,
      debtor: municipio,
      tribunal: 'TJSP',
      numeroProcessoDEPRE: depre,
      numeroProcessoDEPRENormalizado: depreDigits,
      contactStatus: statusContato,
      contactRoute: rotaContato,
      sourceFileName: 'CP_pacote_completo_73_DEPREs.xlsx',
    },
  });

  created += 1;
  seen.add(depreDigits);
}

await finishImport(
  started.batch.id,
  organizationId,
  'COMPLETED',
  {
    read: rawData.length,
    created,
    updated: 0,
    duplicates: 0,
    conflicts: 0,
    rpvs: 0,
    skipped,
    belowMinimum: 0,
    incomplete: 0,
    errors: 0,
  },
  [],
);

console.log(JSON.stringify({
  workbook: workbookPath.pathname,
  rowsRead: rawData.length,
  created,
  skipped,
  organizationId,
  batchId: started.batch.id,
}, null, 2));
