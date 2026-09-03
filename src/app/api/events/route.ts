import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@libsql/client";
import { rateLimit } from "@/lib/rate-limit";
const attributionValue = z.union([z.string().max(500), z.null()]);
const schema = z.object({
  name: z.enum(["page_view", "whatsapp_click"]),
  page: z.string().max(200),
  at: z.string().datetime(),
  attribution: z.record(z.string().max(40), z.record(z.string().max(30), attributionValue)).optional(),
});
const db = createClient({
  url: process.env.DATABASE_URL || "file:central-precatorios.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});
export async function POST(request: Request) {
  if (!(await rateLimit(request, "events", 60, 60)))
    return NextResponse.json({ ok: false }, { status: 429 });
  const p = schema.safeParse(await request.json().catch(() => null));
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
