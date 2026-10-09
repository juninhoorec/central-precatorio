import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@libsql/client";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-validation";
import { createDatabaseClient } from "@/lib/database-config";
const attributionValue = z.union([z.string().max(500), z.null()]);
const schema = z.object({
  name: z.enum(["page_view", "whatsapp_click"]),
  page: z.string().max(200),
  at: z.string().datetime(),
  attribution: z.record(z.string().max(40), z.record(z.string().max(30), attributionValue)).optional(),
});
const db = createDatabaseClient();
export async function POST(request: Request) {
  if (!(await rateLimit(request, "events", 60, 60)))
    return NextResponse.json({ ok: false }, { status: 429 });
  const body = await readJsonBody(request, 32 * 1024);
  if (!body.ok) return NextResponse.json({ ok: false }, { status: body.reason === "too_large" ? 413 : 400 });
  const p = schema.safeParse(body.value);
  if (!p.success) return NextResponse.json({ ok: false }, { status: 400 });
  await db.execute(
    `CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY,name TEXT NOT NULL,page TEXT NOT NULL,attribution TEXT,created_at TEXT NOT NULL)`,
  );
  await db.execute({
    sql: "INSERT INTO events VALUES (?,?,?,?,?)",
    args: [
      crypto.randomUUID(),
      p.data.name,
      p.data.page,
      JSON.stringify(p.data.attribution || {}),
      new Date().toISOString(),
    ],
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}
