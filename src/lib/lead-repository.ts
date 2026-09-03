import "server-only";
import { createClient } from "@libsql/client";
import type { LeadInput } from "./lead-schema";

export type StoredLead = LeadInput & {
  id: string;
  score: number;
  classification: string;
  createdAt: string;
  status: "NOVO";
};
const client = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
let initialized: Promise<void> | undefined;
function initialize() {
  initialized ??= client
    .execute(
      `CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, idempotency_key TEXT NOT NULL UNIQUE, mode TEXT NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT, answers TEXT NOT NULL, attribution TEXT, consent TEXT NOT NULL, landing_page TEXT NOT NULL, score INTEGER NOT NULL, classification TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'NOVO', created_at TEXT NOT NULL)`,
    )
    .then(() => undefined);
  return initialized;
}

export async function saveLead(lead: StoredLead) {
  await initialize();
  await client.execute({
    sql: `INSERT INTO leads (id,idempotency_key,mode,name,phone,email,answers,attribution,consent,landing_page,score,classification,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`,
    args: [
      lead.id,
      lead.idempotencyKey,
      lead.mode,
      lead.name,
      lead.phone,
      lead.email || null,
      JSON.stringify(lead.answers),
      JSON.stringify(lead.attribution || {}),
      JSON.stringify(lead.consent),
      lead.landingPage,
      lead.score,
      lead.classification,
      lead.status,
      lead.createdAt,
    ],
  });
  const result = await client.execute({
    sql: "SELECT * FROM leads WHERE idempotency_key = ?",
    args: [lead.idempotencyKey],
  });
  const row = result.rows[0];
  return {
    ...lead,
    id: String(row.id),
    score: Number(row.score),
    classification: String(row.classification),
  };
}

export async function listLeads(limit = 50) {
  await initialize();
  const result = await client.execute({
    sql: "SELECT id,name,phone,email,mode,score,classification,status,created_at,answers,attribution FROM leads ORDER BY created_at DESC LIMIT ?",
    args: [limit],
  });
  return result.rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    phone: String(row.phone),
    email: row.email ? String(row.email) : "",
    mode: String(row.mode),
    score: Number(row.score),
    classification: String(row.classification),
    status: String(row.status),
    createdAt: String(row.created_at),
    answers: JSON.parse(String(row.answers)),
    attribution: JSON.parse(String(row.attribution)),
  }));
}
