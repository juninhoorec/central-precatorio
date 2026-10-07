import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { updateManualTaskStatus, type ManualTaskStatus, type ManualTaskCompletionReason } from "@/lib/manual-research";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const organizationId = body.organizationId || "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
    const actorUserId = body.actorUserId || "system";
    const status = body.status as ManualTaskStatus;
    const completedReason = body.completedReason as ManualTaskCompletionReason | undefined;

    const db = createClient({
      url: process.env.DATABASE_URL || "file:central-precatorios.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    const task = await updateManualTaskStatus(
      id,
      organizationId,
      status,
      actorUserId,
      completedReason,
      db
    );

    return NextResponse.json({ task });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
