-- Keep the task tenant-operation relationship intact after insertion.
CREATE TRIGGER IF NOT EXISTS manual_tasks_tenant_update_guard
BEFORE UPDATE OF organization_id, operation_id ON manual_research_tasks
FOR EACH ROW
BEGIN
  SELECT RAISE(ABORT, 'MANUAL_TASK_TENANT_MISMATCH')
  WHERE NOT EXISTS (
    SELECT 1
    FROM operations
    WHERE id = NEW.operation_id
      AND organization_id = NEW.organization_id
  );
END;
