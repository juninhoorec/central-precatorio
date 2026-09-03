import "server-only";
import { createHash } from "node:crypto";
import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

export async function rateLimit(request: Request, bucket: string, maximum: number, windowSeconds = 600) {
  const source = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = createHash("sha256").update(`${bucket}:${source}`).digest("hex");
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  await db.execute("CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY,bucket_key TEXT NOT NULL,created_at TEXT NOT NULL)");
  await db.execute({ sql: "DELETE FROM rate_limits WHERE created_at < ?", args: [since] });
  const result = await db.execute({ sql: "SELECT COUNT(*) AS total FROM rate_limits WHERE bucket_key = ? AND created_at >= ?", args: [key, since] });
  if (Number(result.rows[0]?.total || 0) >= maximum) return false;
  await db.execute({ sql: "INSERT INTO rate_limits VALUES (?,?,?)", args: [crypto.randomUUID(), key, new Date().toISOString()] });
  return true;
}
