import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantPermission: vi.fn(),
  appendAudit: vi.fn(),
  createOperation: vi.fn(),
  getOperation: vi.fn(),
  listOperations: vi.fn(),
  updateOperation: vi.fn(),
  documentGetMetadata: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({ requireTenantPermission: mocks.requireTenantPermission }));
vi.mock("@/lib/audit", () => ({ appendAudit: mocks.appendAudit }));
vi.mock("@/lib/document-storage", () => ({ documentStorage: { getMetadata: mocks.documentGetMetadata } }));
vi.mock("@/lib/operations", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/operations")>();
  return {
    ...actual,
    createOperation: mocks.createOperation,
    getOperation: mocks.getOperation,
    listOperations: mocks.listOperations,
    updateOperation: mocks.updateOperation,
  };
});

import { createDefaultWorkflow } from "@/lib/operational-workflow";
import { POST, PUT } from "./route";

const operationId = "11111111-1111-4111-8111-111111111111";
function basePayload() {
  return {
    title: "Draft operation",
    debtor: "Estado de São Paulo",
    tribunal: "TJSP",
    process: "",
    owner: "",
    source: "manual entry",
    stage: "Entrada",
    nominal: 0,
    notes: "Draft",
    tasks: [],
    checks: [],
    proposals: [],
    workflow: createDefaultWorkflow(0),
    isDemo: false,
  };
}
function request(path: string, method: "POST" | "PUT", body: unknown) {
  return new Request(`https://cp.test${path}`, {
    method,
    headers: { origin: "https://cp.test", host: "cp.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("operation API documentary truth guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantPermission.mockResolvedValue({ organizationId: "tenant-a", userId: "user-a", role: "analyst" });
    mocks.appendAudit.mockResolvedValue({ id: "audit-a" });
    mocks.createOperation.mockResolvedValue({ ...basePayload(), id: operationId, version: 1, history: [] });
  });

  it("rejects a new operation that mass-assigns official evidence", async () => {
    const payload = basePayload();
    payload.workflow.evidence = [{
      id: crypto.randomUUID(), source: "client claim", sourceType: "OFFICIAL", reference: "DOC-1",
      retrievedAt: new Date().toISOString(), confidence: 100, status: "CONFIRMADO", notes: "claimed verified",
    }];

    const response = await POST(request("/api/operations", "POST", payload));

    expect(response.status).toBe(403);
    expect(mocks.createOperation).not.toHaveBeenCalled();
  });

  it("rejects an operation update that mass-assigns readiness or coverage", async () => {
    const current = { ...basePayload(), id: operationId, version: 1, history: [] };
    mocks.getOperation.mockResolvedValue(current);
    const next = { ...current, workflow: { ...current.workflow, documentStatus: "READY" as const } };

    const response = await PUT(request("/api/operations", "PUT", next));

    expect(response.status).toBe(403);
    expect(mocks.updateOperation).not.toHaveBeenCalled();
  });

  it("allows the server-controlled creation path for an unverified draft", async () => {
    const response = await POST(request("/api/operations", "POST", basePayload()));

    expect(response.status).toBe(201);
    expect(mocks.createOperation).toHaveBeenCalledWith(expect.objectContaining({ workflow: expect.objectContaining({ documentStatus: "MISSING" }) }), undefined, "tenant-a", "user-a");
  });
});
