import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getManualResearchTask: vi.fn(),
  submitManualEvidence: vi.fn(),
  requireSameOrigin: vi.fn(),
  requireTenantPermission: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/manual-research", () => ({
  getManualResearchTask: mocks.getManualResearchTask,
  submitManualEvidence: mocks.submitManualEvidence,
}));
vi.mock("@/lib/tenant", () => ({
  requireSameOrigin: mocks.requireSameOrigin,
  requireTenantPermission: mocks.requireTenantPermission,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@libsql/client", () => ({ createClient: vi.fn(() => ({})) }));

import { POST } from "./route";

const task = {
  id: "11111111-1111-4111-8111-111111111111",
  organizationId: "tenant-a",
  operationId: "22222222-2222-4222-8222-222222222222",
  depre: "0032722-57.2014.8.26.0500",
  source: "TJSP e-SAJ",
};
const context = { params: Promise.resolve({ id: task.id }) };
const validBody = {
  officialUrl: "https://www.tjsp.jus.br/Precatorios/consulta",
  documentIdentifier: "DOC-1",
  documentReference: "CERTIDAO",
  documentDate: "2026-10-01",
  evidenceNotes: "Trecho localizado para conferência documental.",
};

function request(body: unknown) {
  return new Request(`https://cp.test/api/manual-research/tasks/${task.id}/evidence`, {
    method: "POST",
    headers: { origin: "https://cp.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST manual evidence security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantPermission.mockResolvedValue({ organizationId: "tenant-a", userId: "user-a", role: "analyst" });
    mocks.rateLimit.mockResolvedValue(true);
    mocks.getManualResearchTask.mockResolvedValue(task);
    mocks.submitManualEvidence.mockResolvedValue({ persistenceResults: [], qualifyingEvidenceCount: 0, evaluationId: null });
  });

  it("binds task, tenant, operation, DEPRE, source and actor from trusted server state", async () => {
    const response = await POST(request(validBody), context);

    expect(response.status).toBe(200);
    expect(mocks.getManualResearchTask).toHaveBeenCalledWith(task.id, "tenant-a", expect.anything());
    expect(mocks.submitManualEvidence).toHaveBeenCalledWith(expect.objectContaining({
      taskId: task.id,
      organizationId: "tenant-a",
      operationId: task.operationId,
      depre: task.depre,
      source: task.source,
      actorUserId: "user-a",
    }), expect.anything());
  });

  it("rejects mass-assigned tenant or actor fields", async () => {
    const response = await POST(request({ ...validBody, organizationId: "tenant-b", actorUserId: "user-b" }), context);

    expect(response.status).toBe(400);
    expect(mocks.getManualResearchTask).not.toHaveBeenCalled();
    expect(mocks.submitManualEvidence).not.toHaveBeenCalled();
  });

  it("does not read task data when authorization denies access", async () => {
    mocks.requireTenantPermission.mockRejectedValue(Response.json({ error: "denied" }, { status: 403 }));

    const response = await POST(request(validBody), context);

    expect(response.status).toBe(403);
    expect(mocks.getManualResearchTask).not.toHaveBeenCalled();
  });
});
