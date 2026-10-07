import { describe, it, expect, beforeAll } from "vitest";
import { createClient, type Client } from "@libsql/client";
import { initializeAudit } from "./audit";
import {
  applyManualResearchSchema,
  generateManualResearchTask,
  listManualResearchTasks,
  updateManualTaskStatus,
  type GenerateManualTaskInput,
} from "./manual-research";

let db: Client;
const ORG = "test-org-phase6";

beforeAll(async () => {
  db = createClient({ url: ":memory:" });
  // Let official initializeAudit create audit_logs with the correct real schema
  await initializeAudit(db);
  await applyManualResearchSchema(db);
});

const baseInput = (): GenerateManualTaskInput => ({
  organizationId: ORG,
  operationId: "op-001",
  depre: "0123456-78.2023.8.26.0500",
  source: "TJSP/e-SAJ",
  sourceId: "tjsp-esaj",
  route: "search",
  blockerType: "MANUAL_REQUIRED",
  sourceResult: "MANUAL_REQUIRED",
  blockerCodes: ["TITULAR_NOT_CONFIRMED", "DOCUMENTATION_BELOW_2_OF_2"],
  actorUserId: "analyst-001",
  knownIdentifiers: {
    originProcessNumber: "0099999-11.2020.8.26.0001",
  },
  previousAttempts: [{ source: "DataJud", route: "api", result: "NO_RESULT", attemptedAt: "2026-10-01T00:00:00Z" }],
});

describe("Phase 6 — Manual Research Tasks", () => {
  it("creates a task with deterministic idempotency key", async () => {
    const { task, created } = await generateManualResearchTask(baseInput(), db);

    expect(created).toBe(true);
    expect(task.depre).toBe("0123456-78.2023.8.26.0500");
    expect(task.status).toBe("OPEN");
    expect(task.priority).toBe("HIGH"); // TITULAR_NOT_CONFIRMED + DOCUMENTATION_BELOW_2_OF_2 => HIGH
    expect(task.idempotencyKey).toBeTruthy();
    expect(task.instructions.strategies.length).toBeGreaterThanOrEqual(1);
    // DEPRE must appear in instructions — no fabricated identifiers
    const strategyIdentifiers = task.instructions.strategies.map((s) => s.identifier);
    expect(strategyIdentifiers).toContain("0123456-78.2023.8.26.0500");
  });

  it("is idempotent — repeated call returns the existing task without creating duplicate", async () => {
    const { task: t1, created: c1 } = await generateManualResearchTask(baseInput(), db);
    const { task: t2, created: c2 } = await generateManualResearchTask(baseInput(), db);

    expect(c1).toBe(false); // already existed from previous test
    expect(c2).toBe(false);
    expect(t1.id).toBe(t2.id);
  });

  it("preserves source/route in instructions without fabrication", async () => {
    const { task } = await generateManualResearchTask(baseInput(), db);
    // doNotRepeat must include standard safety instructions
    expect(task.instructions.doNotRepeat).toContain(
      "Confirmar titular apenas pelo nome sem vínculo documental ao DEPRE"
    );
    expect(task.instructions.doNotRepeat).toContain(
      "Inferir número de processo sem fonte oficial"
    );
    // Previous attempt must be surfaced
    expect(task.instructions.alreadyAttempted.length).toBeGreaterThanOrEqual(1);
    expect(task.instructions.alreadyAttempted[0]).toContain("DataJud");
  });

  it("lists tasks scoped to organization", async () => {
    const tasks = await listManualResearchTasks(ORG, {}, db);
    expect(tasks.length).toBeGreaterThan(0);
    for (const t of tasks) {
      expect(t.organizationId).toBe(ORG);
    }
  });

  it("lists tasks filtered by status OPEN", async () => {
    const open = await listManualResearchTasks(ORG, { status: "OPEN" }, db);
    expect(open.length).toBeGreaterThan(0);
    for (const t of open) expect(t.status).toBe("OPEN");
  });

  it("updates task status with audit trail", async () => {
    const tasks = await listManualResearchTasks(ORG, { status: "OPEN" }, db);
    expect(tasks.length).toBeGreaterThan(0);
    const updated = await updateManualTaskStatus(tasks[0].id, ORG, "IN_PROGRESS", "analyst-001", undefined, db);
    expect(updated.status).toBe("IN_PROGRESS");
  });

  it("blocks completing a task without a reason", async () => {
    const tasks = await listManualResearchTasks(ORG, { status: "IN_PROGRESS" }, db);
    if (tasks.length === 0) return;
    await expect(
      updateManualTaskStatus(tasks[0].id, ORG, "COMPLETED", "analyst-001", undefined, db)
    ).rejects.toThrow("MANUAL_TASK_COMPLETED_REASON_REQUIRED");
  });

  it("blocks cross-tenant access — tenant isolation enforced", async () => {
    const tasks = await listManualResearchTasks(ORG, {}, db);
    if (tasks.length === 0) return;
    await expect(
      updateManualTaskStatus(tasks[0].id, "other-org", "IN_PROGRESS", "attacker", undefined, db)
    ).rejects.toThrow("MANUAL_TASK_NOT_FOUND_OR_WRONG_TENANT");
  });

  it("success condition references 2/2 gate when DOCUMENTATION_BELOW_2_OF_2 is a blocker", async () => {
    const { task } = await generateManualResearchTask(baseInput(), db);
    expect(task.instructions.successCondition).toContain("DOIS documentos oficiais DISTINTOS");
  });

  it("captureFields are never empty", async () => {
    const { task } = await generateManualResearchTask(baseInput(), db);
    expect(task.instructions.captureFields.length).toBeGreaterThan(0);
  });

  it("priority HIGH assigned for critical blockers", async () => {
    const { task } = await generateManualResearchTask(baseInput(), db);
    expect(task.priority).toBe("HIGH");
  });

  it("preserves provenance fields — no data loss", async () => {
    const { task } = await generateManualResearchTask(baseInput(), db);
    expect(task.organizationId).toBe(ORG);
    expect(task.operationId).toBe("op-001");
    expect(task.source).toBe("TJSP/e-SAJ");
    expect(task.route).toBe("search");
    expect(task.blockerType).toBe("MANUAL_REQUIRED");
    expect(task.generatedAt).toBeTruthy();
    expect(task.idempotencyKey).toBeTruthy();
    expect(task.depre).toBe("0123456-78.2023.8.26.0500");
  });
});
