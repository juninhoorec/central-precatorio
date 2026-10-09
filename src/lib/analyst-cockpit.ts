/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type Client } from "@libsql/client";

import { listManualResearchTasks } from "./manual-research";
import { getOperation } from "./operations";
import { listOfficialEvidence, countVerifiedOfficialEvidence } from "./autonomous-acquisition";
import { createDatabaseClient } from "./database-config";

// --- 10-01 ANALYST QUEUE ---

export type AnalystQueueItem = {
  taskId: string;
  operationId: string;
  depre: string;
  devedor: string;
  titular: string;
  beneficiaryCount: number;
  documentationCount: number;
  blockerCount: number;
  blockerCategories: string[];
  priority: string;
  taskStatus: string;
  lastResearchAttempt: string | null;
  lastEvidenceUpdate: string | null;
  lastOpportunityEvaluation: string | null;
  recommendedNextAction: string;
  sourceAvailability: string;
  tenant: string;
};

export async function getAnalystQueue(
  organizationId: string,
  filters: { status?: string; blocker?: string; depre?: string } = {},
  client?: Client
): Promise<AnalystQueueItem[]> {
  const c = client || createDatabaseClient();
  const tasks = await listManualResearchTasks(organizationId, {}, c);
  
  const queue: AnalystQueueItem[] = [];

  for (const task of tasks) {
    if (filters.status && task.status !== filters.status) continue;
    if (filters.depre && !task.depre.includes(filters.depre)) continue;
    
    // Evaluate blockers
    const activeBlockers = task.instructions.targetBlockerCodes;
    if (filters.blocker && !activeBlockers.includes(filters.blocker as any)) continue;

    const op = await getOperation(task.operationId, client, organizationId);
    if (!op) continue;

    const wf = (op.workflow ?? {}) as any;
    const clientInfo = wf.client ?? {};
    const beneficiaries = Array.isArray(clientInfo.beneficiaries) ? clientInfo.beneficiaries : [];
    
    // Titular resolution
    const titulars = beneficiaries.filter((b: any) => b.role === "TITULAR");
    let titularName = "UNRESOLVED";
    if (titulars.length === 1 && titulars[0].status === "CURRENT_CONFIRMED") {
      titularName = titulars[0].name || "CONFIRMED";
    } else if (titulars.length > 0) {
      titularName = "PENDING_RESOLUTION";
    }

    // Latest Opportunity Eval
    const evalResult = await c.execute({
      sql: `SELECT * FROM opportunity_evaluations WHERE operation_id=? ORDER BY evaluated_at DESC LIMIT 1`,
      args: [op.id]
    });
    const latestEval = evalResult.rows[0] as any;

    // Latest Evidence
    const evidenceResult = await c.execute({
      sql: `SELECT collected_at FROM official_evidence_documents WHERE operation_id=? ORDER BY collected_at DESC LIMIT 1`,
      args: [op.id]
    });
    const latestEvidence = evidenceResult.rows[0]?.collected_at as string | null;

    // Latest Research Attempt
    const eventsResult = await c.execute({
      sql: `SELECT consulted_at FROM acquisition_events WHERE operation_id=? ORDER BY consulted_at DESC LIMIT 1`,
      args: [op.id]
    });
    const latestAttempt = eventsResult.rows[0]?.consulted_at as string | null;

    // Docs count
    const docs = await listOfficialEvidence(op.id, organizationId, c);
    const docsCount = countVerifiedOfficialEvidence(docs);

    // Recommended next action
    let nextAction = "Investigate source block.";
    if (activeBlockers.includes("DOCUMENTATION_BELOW_2_OF_2")) nextAction = "Obtain another distinct official document.";
    else if (activeBlockers.includes("TITULAR_NOT_CONFIRMED")) nextAction = "Search official source using known identifiers.";
    else if (activeBlockers.includes("VALUE_NOT_CONFIRMED")) nextAction = "Locate authoritative value/date-base publication.";
    else if (activeBlockers.includes("LAWYER_NOT_CONFIRMED")) nextAction = "Locate official lawyer/OAB evidence.";
    else if (activeBlockers.includes("CONTACT_NOT_CONFIRMED")) nextAction = "Investigate permitted professional/contact route.";

    queue.push({
      taskId: task.id,
      operationId: op.id,
      depre: task.depre,
      devedor: op.debtor || wf.credit?.debtorName || "MISSING",
      titular: titularName,
      beneficiaryCount: beneficiaries.length,
      documentationCount: docsCount,
      blockerCount: activeBlockers.length,
      blockerCategories: activeBlockers,
      priority: task.priority,
      taskStatus: task.status,
      lastResearchAttempt: latestAttempt || null,
      lastEvidenceUpdate: latestEvidence || null,
      lastOpportunityEvaluation: latestEval ? String(latestEval.evaluated_at) : null,
      recommendedNextAction: nextAction,
      sourceAvailability: task.blockerType || "UNKNOWN",
      tenant: organizationId
    });
  }

  return queue;
}

// --- 10-02 CASE DETAIL WORKSPACE ---

export type CaseDetailWorkspace = {
  identification: {
    depre: string;
    titular: string;
    beneficiaries: any[];
    devedor: string;
  };
  process: {
    originatingProcess: string;
    depreProcess: string;
  };
  financial: {
    value: number | null;
    valueDateBase: string | null;
    source: string | null;
  };
  lawyer: {
    name: string | null;
    oab: string | null;
    source: string | null;
  };
  contact: {
    status: string;
  };
  documentation: {
    count: number;
    documents: any[];
  };
  blockers: Array<{
    reason: string;
    affectedField: string;
    recommendedAction: string;
  }>;
  auditHistory: any[];
};

export async function getCaseDetail(
  operationId: string,
  organizationId: string,
  client?: Client
): Promise<CaseDetailWorkspace | null> {
  const c = client || createDatabaseClient();
  const op = await getOperation(operationId, c, organizationId);
  if (!op) return null;

  const wf = (op.workflow ?? {}) as any;
  const clientInfo = wf.client ?? {};
  const creditInfo = wf.credit ?? {};
  const beneficiaries = Array.isArray(clientInfo.beneficiaries) ? clientInfo.beneficiaries : [];
  const titulars = beneficiaries.filter((b: any) => b.role === "TITULAR");
  
  let titularName = "UNRESOLVED";
  if (titulars.length === 1 && titulars[0].status === "CURRENT_CONFIRMED") {
    titularName = titulars[0].name || "CONFIRMED";
  }

  // Documentation
  const docs = await listOfficialEvidence(operationId, organizationId, c);
  const docsCount = countVerifiedOfficialEvidence(docs);

  // Eval
  const evalResult = await c.execute({
    sql: `SELECT * FROM opportunity_evaluations WHERE operation_id=? ORDER BY evaluated_at DESC LIMIT 1`,
    args: [operationId]
  });
  const latestEval = evalResult.rows[0] as any;
  
  const blockersList: any[] = [];
  if (latestEval && latestEval.blocker_codes) {
    const codes = String(latestEval.blocker_codes).split(",").filter(Boolean);
    for (const code of codes) {
      let action = "Investigate source block.";
      let field = "N/A";
      if (code === "DOCUMENTATION_BELOW_2_OF_2") { action = "Obtain another distinct official document."; field = "Documentation"; }
      if (code === "TITULAR_NOT_CONFIRMED") { action = "Search official source using known identifiers."; field = "Titular"; }
      if (code === "VALUE_NOT_CONFIRMED") { action = "Locate authoritative value/date-base publication."; field = "Value"; }
      if (code === "LAWYER_NOT_CONFIRMED") { action = "Locate official lawyer/OAB evidence."; field = "Lawyer"; }
      if (code === "CONTACT_NOT_CONFIRMED") { action = "Investigate permitted professional/contact route."; field = "Contact"; }
      if (code === "INSUFFICIENT_SOURCE_COVERAGE") { action = "Investigate permitted professional/contact route."; field = "Coverage"; }

      blockersList.push({
        reason: code,
        affectedField: field,
        recommendedAction: action
      });
    }
  }

  // Audit
  const auditResult = await c.execute({
    sql: `SELECT * FROM audit_logs WHERE entity_id=? OR (entity_type='opportunity_evaluation' AND metadata LIKE ?) ORDER BY timestamp DESC`,
    args: [operationId, `%${operationId}%`]
  });

  return {
    identification: {
      depre: creditInfo.numeroProcessoDEPRE || "MISSING",
      titular: titularName,
      beneficiaries,
      devedor: op.debtor || creditInfo.debtorName || "MISSING"
    },
    process: {
      originatingProcess: creditInfo.originProcessNumber || "MISSING",
      depreProcess: creditInfo.numeroProcessoDEPRE || "MISSING"
    },
    financial: {
      value: creditInfo.grossAmount || null,
      valueDateBase: creditInfo.valueDate || null,
      source: "unknown"
    },
    lawyer: {
      name: creditInfo.legalRepName || null,
      oab: creditInfo.legalRepOab || null,
      source: null
    },
    contact: {
      status: (clientInfo.phone || clientInfo.email) ? "PROFESSIONAL_ROUTE" : "NO_CONFIRMED_CONTACT"
    },
    documentation: {
      count: docsCount,
      documents: docs
    },
    blockers: blockersList,
    auditHistory: auditResult.rows
  };
}
