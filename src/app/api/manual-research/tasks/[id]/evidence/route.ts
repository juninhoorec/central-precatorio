import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { submitManualEvidence } from "@/lib/manual-research";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await req.json();

    const db = createClient({
      url: process.env.DATABASE_URL || "file:central-precatorios.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    const result = await submitManualEvidence(
      {
        taskId: id,
        organizationId: body.organizationId || "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u",
        actorUserId: body.actorUserId || "system",
        operationId: body.operationId,
        depre: body.depre,
        officialUrl: body.officialUrl,
        documentIdentifier: body.documentIdentifier,
        documentReference: body.documentReference,
        documentDate: body.documentDate,
        source: body.source,
        evidenceNotes: body.evidenceNotes,
        rawExcerpt: body.rawExcerpt,
      },
      db
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
