import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { generateManualResearchBatch } from "@/lib/manual-research";
import type { OpportunityBlockerCode } from "@/lib/opportunity-engine";

type SourceAttempt = { source: string; sourceId: string; route: string; result: string; attemptedAt: string };

export async function POST(req: Request) {
  try {
    const db = createClient({
      url: process.env.DATABASE_URL || "file:central-precatorios.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });

    const body = await req.json();
    const organizationId = body.organizationId || "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
    const actorUserId = body.actorUserId || "system";

    const rows = await db.execute({
      sql: `
        SELECT 
          o.id as operation_id, 
          json_extract(o.workflow, '$.credit.numeroProcessoDEPRE') as depre, 
          oe.blocker_codes,
          (
            SELECT json_group_array(json_object(
              'source', source_id,
              'sourceId', source_id,
              'route', event_type,
              'result', status,
              'attemptedAt', consulted_at
            ))
            FROM acquisition_events aa
            WHERE aa.operation_id = o.id 
              AND aa.status IN ('MANUAL_REQUIRED', 'CAPTCHA_REQUIRED', 'AUTH_REQUIRED', 'NO_RESULT', 'RATE_LIMITED', 'INVALID_QUERY', 'ASSISTED_SOURCE_REQUIRED')
          ) as source_attempts
        FROM operations o
        JOIN opportunity_evaluations oe ON oe.operation_id = o.id
        WHERE o.organization_id = ? 
          AND o.id NOT LIKE 'demo-%'
          AND oe.blocker_codes IS NOT NULL
          AND oe.blocker_codes != '[]'
        GROUP BY o.id
        ORDER BY o.created_at DESC
        LIMIT 100
      `,
      args: [organizationId],
    });

    const candidates: Array<{ operationId: string; depre: string; blockerCodes: readonly OpportunityBlockerCode[]; sourceAttempts: SourceAttempt[] }> = [];
    for (const row of rows.rows) {
      if (candidates.length >= 20) break;

      const blockerCodes = JSON.parse(String(row.blocker_codes || "[]")) as OpportunityBlockerCode[];
      const rawAttempts = JSON.parse(String(row.source_attempts || "[]")) as Record<string, unknown>[];
      const sourceAttempts: SourceAttempt[] = rawAttempts.map(a => ({
        source: String(a.source ?? ""),
        sourceId: String(a.sourceId ?? ""),
        route: String(a.route ?? ""),
        result: String(a.result ?? ""),
        attemptedAt: String(a.attemptedAt ?? ""),
      }));

      if (blockerCodes.length > 0) {
        candidates.push({
          operationId: String(row.operation_id),
          depre: String(row.depre),
          blockerCodes,
          sourceAttempts,
        });
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ message: "No candidates found for pilot" }, { status: 404 });
    }

    const summary = await generateManualResearchBatch(candidates, organizationId, actorUserId, db);

    return NextResponse.json({
      message: "Pilot executed successfully",
      casesProcessed: candidates.length,
      summary,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Error in pilot:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
