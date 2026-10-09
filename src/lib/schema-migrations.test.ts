import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { applySchemaMigrations, assertSchemaMigrations } from "./schema-migrations";

describe("versioned schema", () => {
	it("applies all versions once to a fresh database and is idempotent", async () => {
		const client = createClient({ url: ":memory:" });
		await client.execute("CREATE TABLE operations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL)");

		const expectedVersions = [
			"001_crm_automation",
			"002_crm_automation_integrity",
			"003_crm_operation_tenant_guard",
			"004_relation_tenant_update_guards",
			"005_opportunity_evaluations",
			"006_manual_research_tasks",
			"007_manual_task_tenant_update_guard",
		];
		expect(await applySchemaMigrations(client)).toHaveLength(expectedVersions.length);
		expect(await applySchemaMigrations(client)).toHaveLength(expectedVersions.length);
		expect(await assertSchemaMigrations(client)).toEqual(expectedVersions);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='automation_jobs'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='opportunity_evaluations'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='manual_research_tasks'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_crm_task_tenant_guard'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='trg_crm_operation_tenant_guard'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='opportunity_evaluations_tenant_insert_guard'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='manual_tasks_tenant_insert_guard'")).rows).toHaveLength(1);
		expect((await client.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='manual_tasks_tenant_update_guard'")).rows).toHaveLength(1);
		await client.close();
	});

	it("rejects direct updates that detach CRM records or operation jobs from their tenant", async () => {
		const client = createClient({ url: ":memory:" });
		await client.execute("CREATE TABLE operations (id TEXT PRIMARY KEY, organization_id TEXT NOT NULL)");
		await client.execute("INSERT INTO operations VALUES('op-a','org-a'),('op-b','org-b')");
		await applySchemaMigrations(client);
		await client.execute("INSERT INTO crm_records VALUES('crm-a','org-a','op-a',NULL,'[]','NEW','now','now',NULL)");
		await client.execute("INSERT INTO automation_jobs(id,organization_id,job_type,target_type,target_id,scheduled_at,status,attempts,max_attempts,idempotency_key,created_by,created_at) VALUES('job-a','org-a','ALERT','operation','op-a','now','PENDING',0,3,'job-a','system','now')");

		await expect(client.execute("UPDATE crm_records SET operation_id='op-b' WHERE id='crm-a'")).rejects.toThrow("CRM_OPERATION_TENANT_MISMATCH");
		await expect(client.execute("UPDATE crm_records SET organization_id='org-b' WHERE id='crm-a'")).rejects.toThrow("CRM_OPERATION_TENANT_MISMATCH");
		await expect(client.execute("UPDATE automation_jobs SET target_id='op-b' WHERE id='job-a'")).rejects.toThrow("AUTOMATION_TARGET_TENANT_MISMATCH");
		await expect(client.execute("UPDATE automation_jobs SET organization_id='org-b' WHERE id='job-a'")).rejects.toThrow("AUTOMATION_TARGET_TENANT_MISMATCH");
		await client.execute("INSERT INTO manual_research_tasks(id,organization_id,operation_id,depre,source,source_id,route,blocker_type,priority,status,generated_at,instructions_json,idempotency_key) VALUES('task-a','org-a','op-a','DEPRE','TJSP','tjsp','manual','MANUAL_REQUIRED','HIGH','OPEN','now','{}','task-a')");
		await expect(client.execute("UPDATE manual_research_tasks SET organization_id='org-b' WHERE id='task-a'")).rejects.toThrow("MANUAL_TASK_TENANT_MISMATCH");
		await expect(client.execute("UPDATE manual_research_tasks SET operation_id='op-b' WHERE id='task-a'")).rejects.toThrow("MANUAL_TASK_TENANT_MISMATCH");
		await client.close();
	});

	it("does not let runtime services silently create an unmigrated schema", async () => {
		const client = createClient({ url: ":memory:" });
		await expect(assertSchemaMigrations(client)).rejects.toThrow("SCHEMA_MIGRATIONS_REQUIRED");
		await client.close();
	});
});
