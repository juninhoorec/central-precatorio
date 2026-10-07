const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:central-precatorios.db' });
(async () => {
  const q = await db.execute(`SELECT o.id, json_extract(o.workflow, '$.credit.numeroProcessoDEPRE') AS depre,
    json_extract(o.workflow, '$.credit.municipality') AS municipality,
    json_extract(o.workflow, '$.credit.debtor') AS debtor,
    json_extract(o.workflow, '$.credit.originProcessNumber') AS origin_process,
    (SELECT COUNT(*) FROM official_evidence_documents e WHERE e.operation_id=o.id) AS evidence_count,
    (SELECT COUNT(*) FROM official_evidence_documents e WHERE e.operation_id=o.id AND e.status='VERIFIED') AS verified_count,
    (SELECT COUNT(*) FROM official_evidence_documents e WHERE e.operation_id=o.id AND e.document_type IN ('OFICIO_REQUISITORIO','OFICIO_COMPLEMENTAR')) AS qualifying_docs
  FROM operations o
  WHERE o.is_demo = 0
  ORDER BY municipality, depre`);
  console.log(JSON.stringify(q.rows, null, 2));
  await db.close();
})();
