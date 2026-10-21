import { createClient } from '@libsql/client';

const client = createClient({
  url: process.env.DATABASE_URL || '',
  authToken: process.env.DATABASE_AUTH_TOKEN || ''
});

async function main() {
  const res = await client.execute({
    sql: "SELECT id, title, debtor, nominal, stage, workflow FROM operations WHERE is_demo = 0 AND (title LIKE ? OR title LIKE ? OR title LIKE ?)",
    args: ['%0498482%', '%7007092%', '%0234462%']
  });
  console.log('Matched operations:', JSON.stringify(res.rows, null, 2));
}

main().catch(console.error);
