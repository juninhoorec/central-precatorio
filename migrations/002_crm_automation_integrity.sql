-- Adds database-level tenant relationship guards and lookup paths without
-- rebuilding or rewriting any operational inventory table.
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_records_org_operation ON crm_records(organization_id, operation_id);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_org_lease ON automation_jobs(organization_id, status, lease_until);
CREATE INDEX IF NOT EXISTS idx_automation_alerts_org_resolution ON automation_alerts(organization_id, resolved, created_at);

CREATE TRIGGER IF NOT EXISTS trg_crm_task_tenant_guard
BEFORE INSERT ON crm_tasks
WHEN NOT EXISTS (SELECT 1 FROM crm_records WHERE id=NEW.crm_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'CRM_RECORD_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_crm_activity_tenant_guard
BEFORE INSERT ON crm_activities
WHEN NOT EXISTS (SELECT 1 FROM crm_records WHERE id=NEW.crm_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'CRM_RECORD_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_crm_stage_history_tenant_guard
BEFORE INSERT ON crm_stage_history
WHEN NOT EXISTS (SELECT 1 FROM crm_records WHERE id=NEW.crm_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'CRM_RECORD_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_automation_operation_tenant_guard
BEFORE INSERT ON automation_jobs
WHEN NEW.target_type='operation'
  AND NOT EXISTS (SELECT 1 FROM operations WHERE id=NEW.target_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'AUTOMATION_TARGET_TENANT_MISMATCH');
END;
