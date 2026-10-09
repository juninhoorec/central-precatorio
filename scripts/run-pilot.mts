import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { generateManualResearchBatch } from "../src/lib/manual-research.ts";

const db = createClient({
  url: requireExplicitDatabaseUrl(),
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function run() {
  const organizationId = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
  const actorUserId = "system";

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

  const candidates = [];
  for (const row of rows.rows) {
    if (candidates.length >= 20) break;
    const blockerCodes = JSON.parse(String(row.blocker_codes || "[]"));
    const sourceAttempts = JSON.parse(String(row.source_attempts || "[]"));
    if (blockerCodes.length > 0) {
      candidates.push({
        operationId: String(row.operation_id),
        depre: String(row.depre),
        blockerCodes,
        sourceAttempts,
      });
    }
  }

  console.log(`Found ${candidates.length} candidates for pilot.`);
  if (candidates.length > 0) {
    const summary = await generateManualResearchBatch(candidates, organizationId, actorUserId, db);
    console.log(JSON.stringify(summary, null, 2));
  }
}
run().catch(console.error).finally(() => process.exit(0));
