const { createClient } = require('@libsql/client');
const ids = [
  '433c2565-d5d0-424a-b0e1-af7e1d3962b2',
  '120ca91d-ac87-47a9-83d6-765f56828680',
  '2da66ef7-5c56-43a1-8eb8-f24ce10d98cd',
  '2ade7ad1-a29d-4551-80ab-2ad59058136f',
  'd9f156b3-a743-4591-b0cf-d9626f87086f'
];
const db = createClient({ url: 'file:central-precatorios.db' });
(async () => {
  const cases = await db.execute(`SELECT id, json_extract(workflow, '$.credit.numeroProcessoDEPRE') AS depre, json_extract(workflow, '$.credit.municipality') AS municipality FROM operations WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  console.log('CASES');
  console.log(JSON.stringify(cases.rows, null, 2));
  const evidence = await db.execute(`SELECT operation_id, source, document_type, status, evidence_strength, source_url, document_identifier, reference, published_at, notes FROM official_evidence_documents WHERE operation_id IN (${ids.map(() => '?').join(',')}) ORDER BY operation_id, published_at`, ids);
  console.log('EVIDENCE');
  console.log(JSON.stringify(evidence.rows, null, 2));
  await db.close();
})();
