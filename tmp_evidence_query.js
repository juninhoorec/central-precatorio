const { createClient } = require('@libsql/client');
const db = createClient({ url: 'file:central-precatorios.db' });
(async () => {
  const r = await db.execute(`SELECT id, operation_id, source, document_type, status, evidence_strength, source_url, document_identifier, reference, published_at, notes FROM official_evidence_documents ORDER BY published_at DESC LIMIT 200`);
  console.log(JSON.stringify(r.rows, null, 2));
  await db.close();
})();
