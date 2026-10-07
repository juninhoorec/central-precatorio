const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:central-precatorios.db' });
(async () => {
  const rows = await db.execute(`
    SELECT o.id, json_extract(o.workflow, '$.credit.numeroProcessoDEPRE') AS depre,
           json_extract(o.workflow, '$.credit.municipality') AS municipality,
           COUNT(e.id) AS evidence_count,
           SUM(CASE WHEN e.status='VERIFIED' THEN 1 ELSE 0 END) AS verified_count,
           SUM(CASE WHEN e.document_type IN ('OFICIO_REQUISITORIO','OFICIO_COMPLEMENTAR') THEN 1 ELSE 0 END) AS qualifying_count
    FROM operations o
    LEFT JOIN official_evidence_documents e ON e.operation_id = o.id
    WHERE o.is_demo = 0
    GROUP BY o.id
    HAVING COUNT(e.id) > 0
    ORDER BY evidence_count DESC, depre ASC
    LIMIT 20`);
  console.log(JSON.stringify(rows.rows, null, 2));
  await db.close();
})();
