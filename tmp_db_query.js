const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:central-precatorios.db' });

(async () => {
  const r = await db.execute(
    `SELECT id, json_extract(workflow, '$.credit.numeroProcessoDEPRE') AS depre,
            json_extract(workflow, '$.credit.debtor') AS debtor,
            json_extract(workflow, '$.credit.municipality') AS municipality,
            json_extract(workflow, '$.credit.debtorState') AS debtor_state,
            json_extract(workflow, '$.credit.officialEvidenceCount') AS official_evidence_count,
            is_demo
     FROM operations
     WHERE is_demo = 0
     ORDER BY id
     LIMIT 20`
  );
  console.log(JSON.stringify(r.rows, null, 2));
  await db.close();
})();
