import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSameOrigin: vi.fn(),
  requireTenantPermission: vi.fn(),
  rateLimit: vi.fn(),
  updateManualTaskStatus: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({ requireSameOrigin: mocks.requireSameOrigin, requireTenantPermission: mocks.requireTenantPermission }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/manual-research", () => ({
  manualTaskStatuses: ["OPEN", "IN_PROGRESS", "WAITING_EXTERNAL", "BLOCKED", "COMPLETED", "CANCELLED"],
  manualTaskCompletionReasons: ["EVIDENCE_SUBMITTED", "DOCUMENT_NOT_FOUND_AFTER_MANUAL_SEARCH", "ACCESS_STILL_BLOCKED", "SOURCE_RETURNED_NO_QUALIFYING_RECORD", "DUPLICATE_DOCUMENT_ALREADY_EXISTS", "INSUFFICIENT_IDENTIFICATION", "OTHER_REVIEW_REQUIRED"],
  updateManualTaskStatus: mocks.updateManualTaskStatus,
}));
vi.mock("@libsql/client", () => ({ createClient: vi.fn(() => ({})) }));

import { PUT } from "./route";

const taskId = "11111111-1111-4111-8111-111111111111";
function request(body: unknown) {
  return new Request(`https://cp.test/api/manual-research/tasks/${taskId}/status`, {
    method: "PUT",
    headers: { origin: "https://cp.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("manual task status authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantPermission.mockResolvedValue({ organizationId: "tenant-a", userId: "user-a", role: "analyst" });
    mocks.rateLimit.mockResolvedValue(true);
    mocks.updateManualTaskStatus.mockResolvedValue({ id: taskId, status: "IN_PROGRESS" });
  });

  it("does not let a caller claim evidence submission without the evidence flow", async () => {
    const response = await PUT(request({ status: "COMPLETED", completedReason: "EVIDENCE_SUBMITTED" }), { params: Promise.resolve({ id: taskId }) });

    expect(response.status).toBe(400);
    expect(mocks.updateManualTaskStatus).not.toHaveBeenCalled();
  });

  it("derives tenant and actor instead of accepting them from the body", async () => {
    const response = await PUT(request({ status: "IN_PROGRESS", organizationId: "tenant-b", actorUserId: "user-b" }), { params: Promise.resolve({ id: taskId }) });

    expect(response.status).toBe(400);
    expect(mocks.updateManualTaskStatus).not.toHaveBeenCalled();
  });
});
