import { createClient, type Client } from "@libsql/client";

export const PARTNER_CONSENT_VERSION = "2026-09-06";

const client = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export type PartnerInput = {
  idempotencyKey: string;
  company: string;
  name: string;
  email: string;
  phone: string;
  profile: string;
  landingPage: string;
};

export async function initializePartners(db: Client = client) {
  await db.execute(`CREATE TABLE IF NOT EXISTS partners (id TEXT PRIMARY KEY,idempotency_key TEXT NOT NULL UNIQUE,company TEXT NOT NULL,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,profile TEXT NOT NULL,landing_page TEXT NOT NULL,status TEXT NOT NULL,created_at TEXT NOT NULL,consent_version TEXT,consent_accepted_at TEXT)`);
  const columns = await db.execute("PRAGMA table_info(partners)");
  const names = new Set(columns.rows.map((row) => String(row.name)));
  if (!names.has("consent_version")) await db.execute("ALTER TABLE partners ADD COLUMN consent_version TEXT");
  if (!names.has("consent_accepted_at")) await db.execute("ALTER TABLE partners ADD COLUMN consent_accepted_at TEXT");
}

export async function savePartner(input: PartnerInput, db: Client = client) {
  await initializePartners(db);
  const id = crypto.randomUUID();
  const acceptedAt = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO partners (id,idempotency_key,company,name,email,phone,profile,landing_page,status,created_at,consent_version,consent_accepted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(idempotency_key) DO NOTHING`,
    args: [id,input.idempotencyKey,input.company,input.name,input.email,input.phone,input.profile,input.landingPage,"NOVO",acceptedAt,PARTNER_CONSENT_VERSION,acceptedAt],
  });
  const stored = await db.execute({ sql: "SELECT id,consent_version,consent_accepted_at FROM partners WHERE idempotency_key = ?", args: [input.idempotencyKey] });
  return { id: String(stored.rows[0].id), consentVersion: String(stored.rows[0].consent_version), consentAcceptedAt: String(stored.rows[0].consent_accepted_at) };
}
