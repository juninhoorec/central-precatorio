import { createHash } from "node:crypto";
import { createClient, type Client } from "@libsql/client";
import type { Opportunity } from "./opportunity-engine";

const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });

export async function persistOpportunityEvaluation(result: Opportunity, client: Client = db) {
  const operation = await client.execute({
    sql: "SELECT id FROM operations WHERE id=? AND organization_id=? AND is_demo=0",
    args: [result.operationId, result.organizationId],
  });
  if (!operation.rows.length) throw new Error("OPPORTUNITY_EVALUATION_TENANT_MISMATCH");
  if (!result.depre) throw new Error("OPPORTUNITY_EVALUATION_DEPRE_REQUIRED");

  const id = createHash("sha256").update(`${result.organizationId}\0${result.operationId}\0${result.evaluationVersion}`).digest("hex");
  const evaluatedAt = new Date().toISOString();
  const resultJson = JSON.stringify(result);
  await client.execute({
    sql: `INSERT INTO opportunity_evaluations (
      id,organization_id,operation_id,opportunity_id,depre,rule_version,qualification_status,
      ready_for_analyst,blocker_codes,blocking_reasons,result_json,evaluated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(organization_id,operation_id,rule_version) DO UPDATE SET
      opportunity_id=excluded.opportunity_id,
      depre=excluded.depre,
      qualification_status=excluded.qualification_status,
      ready_for_analyst=excluded.ready_for_analyst,
      blocker_codes=excluded.blocker_codes,
      blocking_reasons=excluded.blocking_reasons,
      result_json=excluded.result_json,
      evaluated_at=excluded.evaluated_at
    WHERE opportunity_evaluations.result_json<>excluded.result_json`,
    args: [
      id,
      result.organizationId,
      result.operationId,
      result.opportunityId,
      result.depre,
      result.evaluationVersion,
      result.status,
      result.readyForAnalyst ? 1 : 0,
      JSON.stringify(result.blockerCodes),
      JSON.stringify(result.blockingReasons),
      resultJson,
      evaluatedAt,
    ],
  });
  const saved = await client.execute({
    sql: "SELECT * FROM opportunity_evaluations WHERE organization_id=? AND operation_id=? AND rule_version=?",
    args: [result.organizationId, result.operationId, result.evaluationVersion],
  });
  return saved.rows[0];
}

export async function listOpportunityEvaluations(organizationId: string, client: Client = db) {
  const result = await client.execute({
    sql: "SELECT * FROM opportunity_evaluations WHERE organization_id=? ORDER BY depre,operation_id",
    args: [organizationId],
  });
  return result.rows;
}