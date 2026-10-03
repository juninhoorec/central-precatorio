import type { Client } from "@libsql/client";
import { countVerifiedOfficialEvidence, type DocumentaryQualificationInput } from "./autonomous-acquisition";

export type OperationalKpis = {
  totalReal: number; uniqueDepre: number; duplicateDepre: number; evidence: number; qualifyingEvidence: number;
  documentation0of2: number; documentation1of2: number; documentation2of2: number; documentation3plus: number;
  crmRecords: number; pendingTasks: number; overdueTasks: number; automationFailed: number; automationManual: number; automationSucceeded: number;
  researchAttempted: number; researchManualRequired: number; researchAuthorizationRequired: number; readyForAnalyst: number;
};

export async function calculateOperationalKpis(client: Client, organizationId: string, now = new Date()): Promise<OperationalKpis> {
  const op = await client.execute({ sql: "SELECT COUNT(*) n, COUNT(DISTINCT json_extract(workflow,'$.credit.numeroProcessoDEPRE')) unique_depre FROM operations WHERE organization_id=? AND is_demo=0", args: [organizationId] });
  const evidence = await client.execute({ sql: "SELECT e.operation_id,e.document_type,e.status,e.evidence_strength,e.source_url,e.document_identifier,e.reference,e.hash FROM official_evidence_documents e JOIN operations o ON o.id=e.operation_id AND o.organization_id=e.organization_id WHERE e.organization_id=? AND o.is_demo=0", args: [organizationId] });
  const operations = await client.execute({ sql: "SELECT id FROM operations WHERE organization_id=? AND is_demo=0", args: [organizationId] });
  const evidenceByOperation = new Map<string, DocumentaryQualificationInput[]>();
  for (const row of evidence.rows) {
    const value = row as Record<string, unknown>;
    const documents = evidenceByOperation.get(String(value.operation_id)) ?? [];
    documents.push({ sourceUrl: String(value.source_url), documentType: String(value.document_type) as DocumentaryQualificationInput["documentType"], status: String(value.status) as DocumentaryQualificationInput["status"], evidenceStrength: String(value.evidence_strength) as DocumentaryQualificationInput["evidenceStrength"], documentIdentifier: String(value.document_identifier), reference: String(value.reference), hash: String(value.hash) });
    evidenceByOperation.set(String(value.operation_id), documents);
  }
  const counts = { zero: 0, one: 0, two: 0, three: 0 }; let qualifyingEvidence = 0;
  for (const row of operations.rows) {
    const count = countVerifiedOfficialEvidence(evidenceByOperation.get(String((row as Record<string, unknown>).id)) ?? []);
    qualifyingEvidence += count;
    if (count === 0) counts.zero++; else if (count === 1) counts.one++; else if (count === 2) counts.two++; else counts.three++;
  }
  const crm = await client.execute({ sql: "SELECT COUNT(*) n FROM crm_records WHERE organization_id=?", args: [organizationId] });
  const tasks = await client.execute({ sql: "SELECT SUM(CASE WHEN status='OPEN' THEN 1 ELSE 0 END) pending, SUM(CASE WHEN status='OPEN' AND due_at IS NOT NULL AND due_at<? THEN 1 ELSE 0 END) overdue FROM crm_tasks WHERE organization_id=?", args: [now.toISOString(), organizationId] });
  const jobs = await client.execute({ sql: "SELECT SUM(CASE WHEN status='FAILED' THEN 1 ELSE 0 END) failed, SUM(CASE WHEN status='SUCCEEDED' THEN 1 ELSE 0 END) succeeded, SUM(CASE WHEN error_code IN ('MANUAL_REQUIRED','CAPTCHA_REQUIRED') THEN 1 ELSE 0 END) manual, COUNT(*) attempted FROM automation_jobs WHERE organization_id=?", args: [organizationId] });
  const real = Number((op.rows[0] as Record<string, unknown>).n); const unique = Number((op.rows[0] as Record<string, unknown>).unique_depre);
  return { totalReal: real, uniqueDepre: unique, duplicateDepre: real - unique, evidence: evidence.rows.length, qualifyingEvidence, documentation0of2: counts.zero, documentation1of2: counts.one, documentation2of2: counts.two, documentation3plus: counts.three, crmRecords: Number((crm.rows[0] as Record<string, unknown>).n ?? 0), pendingTasks: Number((tasks.rows[0] as Record<string, unknown>).pending ?? 0), overdueTasks: Number((tasks.rows[0] as Record<string, unknown>).overdue ?? 0), automationFailed: Number((jobs.rows[0] as Record<string, unknown>).failed ?? 0), automationManual: Number((jobs.rows[0] as Record<string, unknown>).manual ?? 0), automationSucceeded: Number((jobs.rows[0] as Record<string, unknown>).succeeded ?? 0), researchAttempted: Number((jobs.rows[0] as Record<string, unknown>).attempted ?? 0), researchManualRequired: Number((jobs.rows[0] as Record<string, unknown>).manual ?? 0), researchAuthorizationRequired: 0, readyForAnalyst: 0 };
}

export type LotImportDecision = { accepted: string[]; deduplicated: string[]; rejected: string[] };
export function validateNewLot(depreIdentifiers: readonly string[], existing: ReadonlySet<string>): LotImportDecision { const seen = new Set<string>(); const accepted: string[] = []; const deduplicated: string[] = []; const rejected: string[] = []; for (const raw of depreIdentifiers) { const normalized = raw.trim(); if (!/^\d{7}-\d{2}\.\d{4}\.8\.26\.\d{4}$/.test(normalized)) { rejected.push(raw); continue; } if (existing.has(normalized) || seen.has(normalized)) deduplicated.push(normalized); else { seen.add(normalized); accepted.push(normalized); } } return { accepted, deduplicated, rejected }; }
