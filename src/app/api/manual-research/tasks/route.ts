import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { listManualResearchTasks, type ManualTaskStatus } from "@/lib/manual-research";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get("organizationId") || "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
    const statusParam = searchParams.get("status");
    const status = statusParam as ManualTaskStatus | undefined ?? undefined;

    const db = createClient({
      url: process.env.DATABASE_URL || "file:central-precatorios.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    const tasks = await listManualResearchTasks(organizationId, { status }, db);
    return NextResponse.json({ tasks });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
