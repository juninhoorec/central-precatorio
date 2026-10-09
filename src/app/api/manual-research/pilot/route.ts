import { NextResponse } from "next/server";
import { createClient } from "@libsql/client";
import { z } from "zod";
import { generateManualResearchBatch } from "@/lib/manual-research";
import type { OpportunityBlockerCode } from "@/lib/opportunity-engine";
import { rateLimit } from "@/lib/rate-limit";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";
import { createDatabaseClient } from "@/lib/database-config";

type SourceAttempt = { source: string; sourceId: string; route: string; result: string; attemptedAt: string };
const emptyBodySchema = z.object({}).strict();
const blockerCodeSchema = z.enum([
  "MISSING_DEPRE", "TITULAR_NOT_CONFIRMED", "MULTIPLE_BENEFICIARIES_UNRESOLVED",
  "DOCUMENTATION_BELOW_2_OF_2", "INSUFFICIENT_SOURCE_COVERAGE", "VALUE_NOT_CONFIRMED",
  "DATE_BASE_NOT_CONFIRMED", "PROCESS_NOT_CONFIRMED", "LAWYER_NOT_CONFIRMED",
  "CONTACT_NOT_CONFIRMED", "STATUS_NOT_CONFIRMED", "EXTERNAL_VERIFICATION_PENDING",
]);
const sourceAttemptSchema = z.object({
  source: z.string().trim().min(1).max(160),
  sourceId: z.string().trim().min(1).max(160),
  route: z.string().trim().min(1).max(160),
  result: z.string().trim().min(1).max(80),
  attemptedAt: z.string().datetime(),
}).strict();

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const tenant = await requireTenantPermission(req.headers, "research:run");
    if (!(await rateLimit(req, "manual-research-pilot", 2, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de execuções atingido. Aguarde antes de tentar novamente." }, { status: 429 });
    }
    const bodyContent = await readJsonBody(req, 1024);
    if (!bodyContent.ok) return NextResponse.json({ error: bodyContent.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: bodyContent.reason === "too_large" ? 413 : 400 });
    if (!emptyBodySchema.safeParse(bodyContent.value).success) {
      return NextResponse.json({ error: "Payload inválido." }, { status: 400 });
    }
    const db = createDatabaseClient();
    const organizationId = tenant.organizationId;
    const actorUserId = tenant.userId;

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

      let blockerValues: unknown;
      let attemptValues: unknown;
      try {
        blockerValues = JSON.parse(String(row.blocker_codes || "[]"));
        attemptValues = JSON.parse(String(row.source_attempts || "[]"));
      } catch {
        continue;
      }
      const parsedBlockers = z.array(blockerCodeSchema).safeParse(blockerValues);
      const parsedAttempts = z.array(sourceAttemptSchema).max(100).safeParse(attemptValues);
      const parsedDepre = z.string().trim().min(5).max(64).safeParse(row.depre);
      if (!parsedBlockers.success || !parsedAttempts.success || !parsedDepre.success) continue;
      const blockerCodes: OpportunityBlockerCode[] = parsedBlockers.data;
      const sourceAttempts: SourceAttempt[] = parsedAttempts.data;

      if (blockerCodes.length > 0) {
        candidates.push({
          operationId: String(row.operation_id),
          depre: parsedDepre.data,
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
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível executar a pesquisa manual." }, { status: 500 });
  }
}
