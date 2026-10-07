import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { createClient } from "@libsql/client";
import { verifyAuditChain } from "../src/lib/audit.js";

const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const org = "nIGADhUkSbiSBSsPl4z08FQ2qIaH3E0u";

async function audit() {
  const gOps = await client.execute("SELECT COUNT(*) total, SUM(CASE WHEN is_demo=0 THEN 1 ELSE 0 END) non_demo, SUM(CASE WHEN is_demo=1 THEN 1 ELSE 0 END) demo FROM operations");
  const tOps = await client.execute({ sql: "SELECT COUNT(*) total, SUM(CASE WHEN is_demo=0 THEN 1 ELSE 0 END) real_ops, SUM(CASE WHEN is_demo=1 THEN 1 ELSE 0 END) demo_ops, COUNT(DISTINCT NULLIF(json_extract(workflow,'$.credit.numeroProcessoDEPRE'),'')) unique_depre FROM operations WHERE organization_id=?", args: [org] });
  const dupDepre = await client.execute({ sql: "SELECT json_extract(workflow,'$.credit.numeroProcessoDEPRE') depre, COUNT(*) c FROM operations WHERE organization_id=? AND is_demo=0 GROUP BY 1 HAVING c > 1", args: [org] });

  const ev = await client.execute({ sql: "SELECT COUNT(*) total, SUM(CASE WHEN status='VERIFIED' AND evidence_strength='STRONG' THEN 1 ELSE 0 END) verified_strong FROM official_evidence_documents WHERE organization_id=?", args: [org] });
  const evOrphans = await client.execute({ sql: "SELECT COUNT(*) c FROM official_evidence_documents e LEFT JOIN operations o ON o.id=e.operation_id AND o.organization_id=e.organization_id WHERE e.organization_id=? AND o.id IS NULL", args: [org] });
  const evDups = await client.execute({ sql: "SELECT hash, COUNT(*) c FROM official_evidence_documents WHERE organization_id=? GROUP BY hash HAVING c > 1", args: [org] });

  const crm = await client.execute({ sql: "SELECT (SELECT COUNT(*) FROM crm_records WHERE organization_id=?) records, (SELECT COUNT(*) FROM crm_tasks WHERE organization_id=?) tasks, (SELECT COUNT(*) FROM crm_activities WHERE organization_id=?) activities", args: [org, org, org] });
  const crmOrphanRecs = await client.execute({ sql: "SELECT COUNT(*) c FROM crm_records c LEFT JOIN operations o ON o.id=c.operation_id AND o.organization_id=c.organization_id WHERE c.organization_id=? AND o.id IS NULL", args: [org] });
  const crmOrphanTasks = await client.execute({ sql: "SELECT COUNT(*) c FROM crm_tasks t LEFT JOIN crm_records r ON r.id=t.crm_id AND r.organization_id=t.organization_id WHERE t.organization_id=? AND r.id IS NULL", args: [org] });

  const auto = await client.execute({ sql: "SELECT COUNT(*) total FROM automation_jobs WHERE organization_id=?", args: [org] });
  const autoInvalid = await client.execute({ sql: "SELECT COUNT(*) c FROM automation_jobs j LEFT JOIN operations o ON o.id=j.target_id AND o.organization_id=j.organization_id WHERE j.organization_id=? AND j.target_type='operation' AND o.id IS NULL", args: [org] });

  const ai = await client.execute({ sql: "SELECT COUNT(*) total, SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) completed, SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) failed, SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) pending, SUM(CASE WHEN result_status='RECONFIRMADO' THEN 1 ELSE 0 END) case_verified FROM ai_reconfirmation_runs WHERE organization_id=?", args: [org] });

  const opp = await client.execute({ sql: "SELECT COUNT(*) total, SUM(CASE WHEN ready_for_analyst=1 THEN 1 ELSE 0 END) ready, SUM(CASE WHEN qualification_status='BLOCKED_BY_IDENTITY' THEN 1 ELSE 0 END) blocked_identity, SUM(CASE WHEN qualification_status='BLOCKED_BY_EVIDENCE' THEN 1 ELSE 0 END) blocked_evidence FROM opportunity_evaluations WHERE organization_id=?", args: [org] });

  const auditLogs = await client.execute({ sql: "SELECT COUNT(*) total FROM audit_logs WHERE organization_id=?", args: [org] });
  const chainValid = await verifyAuditChain(org, client);

  console.log(JSON.stringify({
    global: gOps.rows[0],
    activeTenant: { ...tOps.rows[0], duplicateDepreGroups: dupDepre.rows.length },
    evidence: { ...ev.rows[0], orphan: evOrphans.rows[0].c, duplicateIdentities: evDups.rows.length },
    crm: { ...crm.rows[0], orphanRecords: crmOrphanRecs.rows[0].c, orphanTasks: crmOrphanTasks.rows[0].c },
    automation: { total: auto.rows[0].total, invalidTargets: autoInvalid.rows[0].c },
    ai: ai.rows[0],
    opportunities: opp.rows[0],
    audit: { totalEvents: auditLogs.rows[0].total, chainValid }
  }, null, 2));

  await client.close();
}

audit();
