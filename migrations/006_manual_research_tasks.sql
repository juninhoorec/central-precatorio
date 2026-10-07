-- Migration 006: Manual Research Tasks (Phase 6)
-- Stores deterministic, idempotent analyst research tasks generated from machine-detected blockers.

CREATE TABLE IF NOT EXISTS manual_research_tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  opportunity_id TEXT,
  depre TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT NOT NULL,
  route TEXT NOT NULL,
  blocker_type TEXT NOT NULL,
  priority TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  generated_at TEXT NOT NULL,
  last_attempt_at TEXT,
  completed_at TEXT,
  completed_reason TEXT,
  instructions_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  FOREIGN KEY (operation_id) REFERENCES operations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS manual_tasks_org_op_idx ON manual_research_tasks(organization_id, operation_id);
CREATE INDEX IF NOT EXISTS manual_tasks_org_status_idx ON manual_research_tasks(organization_id, status);

CREATE TRIGGER IF NOT EXISTS manual_tasks_tenant_insert_guard
BEFORE INSERT ON manual_research_tasks
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'MANUAL_TASK_TENANT_MISMATCH: operation_id does not belong to organization_id')
  WHERE (SELECT COUNT(*) FROM operations WHERE id = NEW.operation_id AND organization_id = NEW.organization_id) = 0;
END;
