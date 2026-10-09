import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTenantPermission: vi.fn(),
  listManualResearchTasks: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({ requireTenantPermission: mocks.requireTenantPermission }));
vi.mock("@/lib/manual-research", () => ({ listManualResearchTasks: mocks.listManualResearchTasks }));
vi.mock("@libsql/client", () => ({ createClient: vi.fn(() => ({})) }));

import { GET } from "./route";

describe("GET /api/manual-research/tasks security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantPermission.mockResolvedValue({ organizationId: "tenant-a", userId: "user-a", role: "analyst" });
    mocks.listManualResearchTasks.mockResolvedValue([]);
  });

  it("always scopes the query to the authenticated tenant", async () => {
    const response = await GET(new Request("https://cp.test/api/manual-research/tasks?organizationId=tenant-b&status=OPEN"));

    expect(response.status).toBe(200);
    expect(mocks.requireTenantPermission).toHaveBeenCalledWith(expect.any(Headers), "operation:read");
    expect(mocks.listManualResearchTasks).toHaveBeenCalledWith("tenant-a", { status: "OPEN" }, expect.anything());
  });

  it("does not access task data when authorization denies the request", async () => {
    mocks.requireTenantPermission.mockRejectedValue(Response.json({ error: "denied" }, { status: 403 }));

    const response = await GET(new Request("https://cp.test/api/manual-research/tasks?organizationId=tenant-b"));

    expect(response.status).toBe(403);
    expect(mocks.listManualResearchTasks).not.toHaveBeenCalled();
  });

  it("rejects unknown status filters", async () => {
    const response = await GET(new Request("https://cp.test/api/manual-research/tasks?status=READY"));

    expect(response.status).toBe(400);
    expect(mocks.listManualResearchTasks).not.toHaveBeenCalled();
  });
});