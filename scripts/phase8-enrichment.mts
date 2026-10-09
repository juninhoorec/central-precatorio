import { requireExplicitDatabaseUrl } from "./database-target.mjs";
import { createClient } from "@libsql/client";
import { getOperation, listOperations } from "../src/lib/operations";
import { enrichOpportunityFromEvidence } from "../src/lib/opportunity-enrichment";

const db = createClient({
  url: requireExplicitDatabaseUrl(),
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const ORGANIZATION_ID = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";
const ACTOR_ID = "system:phase8";

async function runEnrichment() {
  console.log("==================================================");
  console.log("PHASE 8 - COMPLETE OPPORTUNITY ENRICHMENT");
  console.log("==================================================");

  // Get Pilot Operations (the 20 ones that have manual tasks)
  const allOps = await listOperations(db, ORGANIZATION_ID);
  
  const tasksResult = await db.execute({
    sql: "SELECT * FROM manual_research_tasks WHERE organization_id = ?",
    args: [ORGANIZATION_ID]
  });
  const manualTasks = tasksResult.rows;
  
  const pilotDepresWithTasks = [...new Set(manualTasks.map(t => String(t.depre)))];
  const pilotOperations = allOps.filter((op) => {
    const wf = op.workflow as Record<string, unknown> | null;
    const credit = (wf && typeof wf === "object" ? wf.credit : undefined) as Record<string, unknown> | undefined;
    const depre = typeof credit?.numeroProcessoDEPRE === "string" ? credit.numeroProcessoDEPRE : undefined;
    return !op.isDemo && depre !== undefined && pilotDepresWithTasks.includes(depre);
  });

  console.log(`Running enrichment on ${pilotOperations.length} pilot operations...`);

  const resultsMatrix: Array<{
    DEPRE: string;
    TITULAR: string;
    DEVEDOR: string;
    VALUE: string;
    DATE_BASE: string;
    PROCESS: string;
    LAWYER_OAB: string;
    CONTACT: string;
    DOC_X_2: string;
    COVERAGE: string;
    BLOCKERS: number;
    READY: boolean;
  }> = [];

  for (const op of pilotOperations) {
    try {
      const result = await enrichOpportunityFromEvidence(op.id, ORGANIZATION_ID, ACTOR_ID, db);
      const wf = op.workflow as Record<string, unknown> | null;
      const credit = (wf && typeof wf === "object" ? wf.credit : undefined) as Record<string, unknown> | undefined;
      const debtor = typeof credit?.debtorState === "string" ? credit.debtorState : (op.debtor ?? "UNKNOWN");
      const queryStatus = typeof wf?.queryStatus === "string" ? wf.queryStatus : "";
      const documentStatus = typeof wf?.documentStatus === "string" ? wf.documentStatus : "";

      resultsMatrix.push({
        DEPRE: result.depre,
        TITULAR: result.titularStatus,
        DEVEDOR: debtor,
        VALUE: result.valueStatus,
        DATE_BASE: result.dateBaseStatus,
        PROCESS: result.processStatus,
        LAWYER_OAB: result.lawyerStatus,
        CONTACT: result.contactStatus,
        DOC_X_2: `${result.qualifyingEvidenceCount}/2`,
        COVERAGE: queryStatus === "SUCCESS" || documentStatus === "COMPLETE" ? "SUFFICIENT" : "INSUFFICIENT",
        BLOCKERS: result.blockers.length,
        READY: result.readyForAnalyst
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`Error enriching operation ${op.id}:`, message);
    }
  }

  console.log("\n--- GAP-8-01 / ENRICHMENT MATRIX ---");
  console.table(resultsMatrix);

}

runEnrichment().catch(console.error);
