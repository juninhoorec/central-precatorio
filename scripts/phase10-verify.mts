import { createClient } from "@libsql/client";
import { applySchemaMigrations } from "../src/lib/schema-migrations";
import { listOperations } from "../src/lib/operations";
import { getAnalystQueue, getCaseDetail } from "../src/lib/analyst-cockpit";

const ORGANIZATION_ID = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u"; 

async function run() {
  const db = createClient({ url: "file:central-precatorios.db" });
  await applySchemaMigrations(db);
  
  console.log("==================================================================");
  console.log("PHASE 10 - 20-CASE ACCEPTANCE MATRIX");
  console.log("==================================================================");

  const operations = await listOperations(db, ORGANIZATION_ID);
  
  // Pilot DEPREs are those that have manual tasks
  const manualTasksRes = await db.execute("SELECT depre FROM manual_research_tasks WHERE organization_id = 'nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u'");
  const pilotDepresWithTasks = [...new Set(manualTasksRes.rows.map(t => String(t.depre)))];
  
  const pilotCases = operations.filter((op) => {
    const wf = op.workflow as Record<string, unknown> | null;
    const credit = (wf && typeof wf === "object" ? wf.credit : undefined) as Record<string, unknown> | undefined;
    const depre = typeof credit?.numeroProcessoDEPRE === "string" ? credit.numeroProcessoDEPRE : undefined;
    return op.source !== "DEMO" && op.isDemo === false && depre !== "9999999-99.9999.9.99.9999" && pilotDepresWithTasks.includes(depre ?? "");
  });

  const queue = await getAnalystQueue(ORGANIZATION_ID, {}, db);

  console.log("DEPRE | Titular | Identity | Docs | Value | Process | Lawyer | Contact | Blockers | Task | READY");
  console.log("-".repeat(120));

  for (const op of pilotCases) {
    const wf = op.workflow as Record<string, unknown> | null;
    const credit = (wf && typeof wf === "object" ? wf.credit : undefined) as Record<string, unknown> | undefined;
    const depre = typeof credit?.numeroProcessoDEPRE === "string" ? credit.numeroProcessoDEPRE : undefined;
    const detail = await getCaseDetail(op.id, ORGANIZATION_ID, db);
    const queueItem = queue.find(q => q.operationId === op.id);

    if (!detail) continue;

    const evalRow = await db.execute({
      sql: `SELECT * FROM opportunity_evaluations WHERE operation_id = ? ORDER BY evaluated_at DESC LIMIT 1`,
      args: [op.id]
    });
    const ready = evalRow.rows[0]?.ready_for_analyst ? "TRUE" : "FALSE";
    const docs = detail.documentation.count + "/2";
    const titular = detail.identification.titular;
    const identity = titular === "CONFIRMED" ? "CONFIRMADO" : "UNRESOLVED";
    const value = detail.financial.value ? "CONFIRMADO" : "UNRESOLVED";
    const processStr = detail.process.originatingProcess !== "MISSING" ? "CONFIRMADO" : "UNRESOLVED";
    const lawyer = detail.lawyer.name ? "CONFIRMADO" : "UNRESOLVED";
    const contact = detail.contact.status;
    const blockers = detail.blockers.length;
    const taskStatus = queueItem?.taskStatus || "NONE";

    console.log(`${depre} | ${titular} | ${identity} | ${docs} | ${value} | ${processStr} | ${lawyer} | ${contact} | ${blockers} | ${taskStatus} | ${ready}`);
  }
}

run().catch(console.error);
