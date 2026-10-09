import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSameOrigin: vi.fn(),
  requireTenantPermission: vi.fn(),
  rateLimit: vi.fn(),
  createPrivateAccess: vi.fn(),
  extractPdfText: vi.fn(),
  searchDocumentEvidence: vi.fn(),
  appendAudit: vi.fn(),
}));

vi.mock("@/lib/tenant", () => ({
  requireSameOrigin: mocks.requireSameOrigin,
  requireTenantPermission: mocks.requireTenantPermission,
}));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit }));
vi.mock("@/lib/document-storage", () => ({ documentStorage: { createPrivateAccess: mocks.createPrivateAccess } }));
vi.mock("@/lib/pdf-analysis", () => ({ extractPdfText: mocks.extractPdfText }));
vi.mock("@/lib/ai/document-evidence-engine", () => ({ searchDocumentEvidence: mocks.searchDocumentEvidence }));
vi.mock("@/lib/audit", () => ({ appendAudit: mocks.appendAudit }));

import { POST } from "./route";

const documentId = "11111111-1111-4111-8111-111111111111";
const evidence = {
  id: "22222222-2222-4222-8222-222222222222",
  documentId,
  organizationId: "tenant-a",
  page: 1,
  textSpan: "Beneficiária Maria Silva",
  normalizedText: "beneficiaria maria silva",
  extractionMethod: "DETERMINISTIC",
  confidence: 95,
  strength: "EXPLICIT",
  detectedKeywords: ["CREDOR"],
};

function request(body: unknown) {
  return new Request("https://cp.test/api/ai/documents/search", {
    method: "POST",
    headers: { origin: "https://cp.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("AI document search security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireTenantPermission.mockResolvedValue({ organizationId: "tenant-a", userId: "user-a", role: "analyst" });
    mocks.rateLimit.mockResolvedValue(true);
    mocks.createPrivateAccess.mockResolvedValue({
      metadata: { id: documentId, organizationId: "tenant-a", operationId: "operation-a", status: "SAFE" },
      bytes: new ArrayBuffer(4),
    });
    mocks.extractPdfText.mockResolvedValue({ pages: ["Beneficiária Maria Silva"] });
    mocks.searchDocumentEvidence.mockReturnValue({
      query: "Maria",
      queryType: "GENERAL_EVIDENCE_SEARCH",
      findingsCount: 1,
      coverage: { pagesAnalyzed: 1, totalPages: 1, coveragePercent: 100, analyzedScopeNote: "1 page" },
      evidenceItems: [evidence],
    });
    mocks.appendAudit.mockResolvedValue({ id: "audit-a" });
  });

  it("uses only the authenticated tenant and writes privacy-minimized audit data", async () => {
    const response = await POST(request({ documentId, query: "Maria", requireExactMatch: true }));

    expect(response.status).toBe(200);
    expect((await response.clone().json()).executionTimeMs).toBeGreaterThanOrEqual(0);
    expect(mocks.createPrivateAccess).toHaveBeenCalledWith(documentId, "tenant-a");
    expect(mocks.appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: "tenant-a",
      actorUserId: "user-a",
      action: "DOCUMENT_SEARCHED",
      metadata: expect.objectContaining({ operationId: "operation-a", queryHash: expect.any(String) }),
    }));
    expect(JSON.stringify(mocks.appendAudit.mock.calls[0][0])).not.toContain("Maria");
  });

  it("rejects client-supplied tenant fields", async () => {
    const response = await POST(request({ documentId, query: "Maria", organizationId: "tenant-b" }));

    expect(response.status).toBe(400);
    expect(mocks.createPrivateAccess).not.toHaveBeenCalled();
  });

  it("does not access documents when authorization denies the request", async () => {
    mocks.requireTenantPermission.mockRejectedValue(Response.json({ error: "denied" }, { status: 403 }));

    const response = await POST(request({ documentId, query: "Maria" }));

    expect(response.status).toBe(403);
    expect(mocks.createPrivateAccess).not.toHaveBeenCalled();
  });

  it("does not send quarantined files to the search engine", async () => {
    mocks.createPrivateAccess.mockResolvedValue({ metadata: { status: "QUARANTINED" }, bytes: new ArrayBuffer(4) });

    const response = await POST(request({ documentId, query: "Maria" }));

    expect(response.status).toBe(404);
    expect(mocks.extractPdfText).not.toHaveBeenCalled();
  });
});
