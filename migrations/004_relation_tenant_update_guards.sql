CREATE TRIGGER IF NOT EXISTS trg_crm_operation_tenant_guard_update
BEFORE UPDATE OF organization_id, operation_id ON crm_records
WHEN NOT EXISTS (SELECT 1 FROM operations WHERE id=NEW.operation_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'CRM_OPERATION_TENANT_MISMATCH');
END;

CREATE TRIGGER IF NOT EXISTS trg_automation_operation_tenant_guard_update
BEFORE UPDATE OF organization_id, target_type, target_id ON automation_jobs
WHEN NEW.target_type='operation'
  AND NOT EXISTS (SELECT 1 FROM operations WHERE id=NEW.target_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'AUTOMATION_TARGET_TENANT_MISMATCH');
END;