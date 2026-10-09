import "server-only";
import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { createClient, type Client } from "@libsql/client";
import { createDatabaseClient } from "./database-config";

const db = createDatabaseClient();

export async function rateLimit(request: Request, bucket: string, maximum: number, windowSeconds = 600, identity = "", client: Client = db) {
  const source = (request.headers.get("x-forwarded-for") || "").split(",").map((part) => part.trim()).filter((part) => isIP(part)).at(-1) || "local";
  const key = createHash("sha256").update(`${bucket}:${source}:${identity.slice(0, 240)}`).digest("hex");
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();
  await client.execute("CREATE TABLE IF NOT EXISTS rate_limits (id TEXT PRIMARY KEY,bucket_key TEXT NOT NULL,created_at TEXT NOT NULL)");
  await client.execute("CREATE INDEX IF NOT EXISTS rate_limits_bucket_created_idx ON rate_limits(bucket_key,created_at)");
  await client.execute({ sql: "DELETE FROM rate_limits WHERE created_at < ?", args: [since] });
  const now = new Date().toISOString();
  const result = await client.execute({
    sql: "INSERT INTO rate_limits(id,bucket_key,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM rate_limits WHERE bucket_key=? AND created_at>=?) < ?",
    args: [crypto.randomUUID(), key, now, key, since, maximum],
  });
  return result.rowsAffected > 0;
}
