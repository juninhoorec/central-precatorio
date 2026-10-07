import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { scoreOpportunity } from "./opportunity-engine";
import { persistOpportunityEvaluation } from "./opportunity-evaluations";
import { applySchemaMigrations } from "./schema-migrations";

const opportunity = (organizationId = "org-a", operationId = "op-a") => scoreOpportunity({
  opportunityId: `opp-${operationId}`,
  operationId,
  organizationId,
  depre: "0000001-00.2024.8.26.0500",
  debtor: "TJSP",
  originalValue: null,
  currentValue: null,
  dataBase: null,
  lawyer: null,
  oab: null,
  contactAvailable: false,
  coverageState: "INSUFFICIENT_COVERAGE",
  qualifyingEvidenceCount: 0,
  aiValidation: "PENDING",
  divergence: false,
  availability: "AVAILABLE",
  titularStatus: "UNRESOLVED",
  valueStatus: "MISSING",
  lawyerStatus: "MISSING",
  contactStatus: "NO_CONFIRMED_CONTACT",
  processStatus: "PENDING",
  ruleVersion: "opportunity-rules-v3",
});

async function prepare(client: ReturnType<typeof createClient>) {
  await client.execute("CREATE TABLE operations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, is_demo INTEGER NOT NULL DEFAULT 0)");
  await client.execute({ sql: "INSERT INTO operations(id,organization_id,is_demo) VALUES('op-a','org-a',0),('op-b','org-b',0),('op-demo','org-a',1)", args: [] });
  await applySchemaMigrations(client);
}

describe("opportunity evaluation persistence", () => {
  it("persists deterministic qualification output idempotently without changing operations", async () => {
    const client = createClient({ url: ":memory:" });
    await prepare(client);
    const result = opportunity();
    const operationBefore = await client.execute("SELECT id,organization_id,is_demo FROM operations WHERE id='op-a'");
    const first = await persistOpportunityEvaluation(result, client);
    const savedAt = first?.evaluated_at;
    const second = await persistOpportunityEvaluation(result, client);
    const rows = await client.execute("SELECT COUNT(*) count FROM opportunity_evaluations");
    const operationAfter = await client.execute("SELECT id,organization_id,is_demo FROM operations WHERE id='op-a'");

    expect(Number(rows.rows[0].count)).toBe(1);
    expect(second?.id).toBe(first?.id);
    expect(second?.evaluated_at).toBe(savedAt);
    expect(JSON.parse(String(second?.result_json))).toMatchObject({ status: result.status, blockerCodes: result.blockerCodes, readyForAnalyst: false });
    expect(operationAfter.rows[0]).toEqual(operationBefore.rows[0]);
    await client.close();
  });

  it("rejects cross-tenant and demo operation evaluations", async () => {
    const client = createClient({ url: ":memory:" });
    await prepare(client);

    await expect(persistOpportunityEvaluation(opportunity("org-b", "op-a"), client)).rejects.toThrow("OPPORTUNITY_EVALUATION_TENANT_MISMATCH");
    await expect(persistOpportunityEvaluation(opportunity("org-a", "op-demo"), client)).rejects.toThrow("OPPORTUNITY_EVALUATION_TENANT_MISMATCH");
    expect(Number((await client.execute("SELECT COUNT(*) count FROM opportunity_evaluations")).rows[0].count)).toBe(0);
    await client.close();
  });
});