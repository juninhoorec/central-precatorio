import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSameOrigin: vi.fn(),
  requireTenantPermission: vi.fn(),
  rateLimit: vi.fn(),
  getOperation: vi.fn(),
  createCrmRecord: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({ requireSameOrigin: mocks.requireSameOrigin, requireTenantPermission: mocks.requireTenantPermission }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/operations", () => ({ getOperation: mocks.getOperation }));
vi.mock("@/lib/crm-service", () => ({
  changeCrmStage: vi.fn(), createCrmActivity: vi.fn(), createCrmRecord: mocks.createCrmRecord,
  createCrmTask: vi.fn(), getCrmRecord: vi.fn(), listCrmRecords: vi.fn(),
}));
vi.mock("@/lib/audit", () => ({ appendAudit: mocks.appendAudit }));

import { POST } from "./route";

const operationId = "11111111-1111-4111-8111-111111111111";
function request(body: unknown) {
  return new Request("https://cp.test/api/crm", {
    method: "POST",
    headers: { origin: "https://cp.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("CRM mutation security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantPermission.mockResolvedValue({ organizationId: "tenant-a", userId: "user-a", role: "analyst" });
    mocks.rateLimit.mockResolvedValue(true);
    mocks.getOperation.mockResolvedValue({ id: operationId });
    mocks.createCrmRecord.mockImplementation(async (record) => record);
    mocks.appendAudit.mockResolvedValue({ id: "audit-a" });
  });

  it("derives tenant and CRM resource ID on the server", async () => {
    const response = await POST(request({ action: "create", operationId }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(mocks.createCrmRecord).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "tenant-a",
      operationId,
      stage: "NEW",
    }));
    expect(body.id).not.toBeUndefined();
    expect(mocks.createCrmRecord.mock.calls[0][0].id).not.toBe(operationId);
  });

  it("rejects client mass assignment of tenant and record IDs", async () => {
    const response = await POST(request({ action: "create", operationId, id: "22222222-2222-4222-8222-222222222222", organizationId: "tenant-b" }));

    expect(response.status).toBe(400);
    expect(mocks.createCrmRecord).not.toHaveBeenCalled();
  });

  it("checks operation ownership before creating the CRM record", async () => {
    mocks.getOperation.mockResolvedValue(null);

    const response = await POST(request({ action: "create", operationId }));

    expect(response.status).toBe(404);
    expect(mocks.createCrmRecord).not.toHaveBeenCalled();
  });
});
