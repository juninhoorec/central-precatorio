-- A CRM record may only reference an operation owned by the same tenant.
CREATE TRIGGER IF NOT EXISTS trg_crm_operation_tenant_guard
BEFORE INSERT ON crm_records
WHEN NOT EXISTS (SELECT 1 FROM operations WHERE id=NEW.operation_id AND organization_id=NEW.organization_id)
BEGIN
  SELECT RAISE(ABORT, 'CRM_OPERATION_TENANT_MISMATCH');
END;
