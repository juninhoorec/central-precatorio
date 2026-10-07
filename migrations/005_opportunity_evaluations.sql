CREATE TABLE IF NOT EXISTS opportunity_evaluations (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  depre TEXT NOT NULL,
  rule_version TEXT NOT NULL,
  qualification_status TEXT NOT NULL,
  ready_for_analyst INTEGER NOT NULL CHECK (ready_for_analyst IN (0,1)),
  blocker_codes TEXT NOT NULL,
  blocking_reasons TEXT NOT NULL,
  result_json TEXT NOT NULL,
  evaluated_at TEXT NOT NULL,
  UNIQUE(organization_id,operation_id,rule_version)
);
CREATE INDEX IF NOT EXISTS opportunity_evaluations_org_status_idx
  ON opportunity_evaluations(organization_id,qualification_status,evaluated_at DESC);
CREATE TRIGGER IF NOT EXISTS opportunity_evaluations_tenant_insert_guard
BEFORE INSERT ON opportunity_evaluations
WHEN NOT EXISTS (
  SELECT 1 FROM operations
  WHERE id=NEW.operation_id AND organization_id=NEW.organization_id AND is_demo=0
)
BEGIN
  SELECT RAISE(ABORT, 'OPPORTUNITY_EVALUATION_TENANT_MISMATCH');
END;
CREATE TRIGGER IF NOT EXISTS opportunity_evaluations_tenant_update_guard
BEFORE UPDATE OF organization_id,operation_id ON opportunity_evaluations
WHEN NOT EXISTS (
  SELECT 1 FROM operations
  WHERE id=NEW.operation_id AND organization_id=NEW.organization_id AND is_demo=0
)
BEGIN
  SELECT RAISE(ABORT, 'OPPORTUNITY_EVALUATION_TENANT_MISMATCH');
END;