import { createClient } from '@libsql/client';

const db = createClient({ url: 'file:central-precatorios.db' });

async function main() {
  const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
  console.log('Tables:', tables.rows.map(r => r.name));
  
  if (tables.rows.some(r => r.name === 'operations')) {
    const opsCount = await db.execute("SELECT count(1) as c FROM operations");
    console.log('Total operations:', opsCount.rows[0].c);
    const sample = await db.execute("SELECT * FROM operations LIMIT 3");
    console.log('Sample operation:\n', JSON.stringify(sample.rows[0], null, 2));
  }
}

main().catch(console.error);
