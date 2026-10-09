import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { appendAudit } from "@/lib/audit";
import { cacRecordsToCsv, readTjspCacReport } from "@/lib/tjsp-cac-report";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { rateLimit } from "@/lib/rate-limit";
import { POST as importNormalizedCsv } from "../import/route";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const CAC_URL = "https://www.tjsp.jus.br/cac/scp/webrelpubliclstpagprecatpendentes.aspx";

export async function POST(request: Request) {
  let tenant: Awaited<ReturnType<typeof requireTenantPermission>> | undefined;
  let captureSessionId = "";
  let sourceFileName = "";
  let sourceFileChecksum = "";
  const requestId = request.headers.get("x-request-id") || crypto.randomUUID();

  try {
    requireSameOrigin(request);
    tenant = await requireTenantPermission(request.headers, "operation:write");
    if (!(await rateLimit(request, "cac-import", 3, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de importações assistidas atingido." }, { status: 429 });
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Selecione o relatório oficial do CAC." }, { status: 400 });
    if (file.size > MAX_FILE_BYTES) return NextResponse.json({ error: "O arquivo excede 20 MB." }, { status: 413 });

    sourceFileName = file.name.replace(/[\r\n/\\]/g, "_").slice(0, 160);
    if (!/\.(pdf|zip)$/i.test(sourceFileName)) return NextResponse.json({ error: "Envie um PDF ou ZIP contendo o relatório oficial do CAC." }, { status: 415 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    sourceFileChecksum = createHash("sha256").update(bytes).digest("hex");
    captureSessionId = createHash("sha256").update(`${tenant.organizationId}:${sourceFileChecksum}`).digest("hex").slice(0, 32);

    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "SOURCE_IMPORT_STARTED",
      entityType: "assisted_capture_session",
      entityId: captureSessionId,
      previousStateSummary: {},
      nextStateSummary: { status: "FILE_RECEIVED", mode: "ASSISTED", sourceId: "tjsp-cac-assisted" },
      metadata: { sourceFileName, sourceFileChecksum, sourceUrl: CAC_URL, fileType: sourceFileName.split(".").pop()?.toLowerCase() || "", captureMode: "ASSISTED" },
      requestId,
      source: "TJSP_CAC_ASSISTED",
    });

    const report = await readTjspCacReport(bytes, sourceFileName);
    const csv = cacRecordsToCsv(report.records, { sourceFileName, sourceFileChecksum, captureSessionId, captureMode: "ASSISTED" });
    const normalizedName = `${sourceFileName.slice(0, 140)}.normalized.csv`;
    const normalizedFile = new File([new TextEncoder().encode(csv)], normalizedName, { type: "text/csv" });
    const forwardedForm = new FormData();
    forwardedForm.set("file", normalizedFile);
    forwardedForm.set("sourceFileName", sourceFileName);
    forwardedForm.set("sourceId", "tjsp-cac-assisted");
    forwardedForm.set("sourceUrl", CAC_URL);
    const minimum = form.get("minimum");
    if (minimum) forwardedForm.set("minimum", String(minimum));
    const dataAsOf = form.get("dataAsOf");
    if (dataAsOf) forwardedForm.set("dataAsOf", String(dataAsOf));

    const headers = new Headers(request.headers);
    headers.delete("content-type");
    headers.delete("content-length");
    const importRequest = new Request(new URL("/api/capture/import", request.url), { method: "POST", headers, body: forwardedForm });
    const response = await importNormalizedCsv(importRequest);
    const result = await response.clone().json().catch(() => ({})) as { batchId?: string; summary?: Record<string, number>; alreadyProcessed?: boolean };
    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: response.ok ? "SOURCE_IMPORT_COMPLETED" : "SOURCE_IMPORT_FAILED",
      entityType: "assisted_capture_session",
      entityId: captureSessionId,
      previousStateSummary: { status: "FILE_RECEIVED" },
      nextStateSummary: { status: response.ok ? "COMPLETED" : "FAILED", importBatchId: result.batchId || "", ...(result.summary || {}) },
      metadata: { sourceFileName, sourceFileChecksum, sourceUrl: CAC_URL, captureMode: "ASSISTED", recordCount: report.records.length, pdfName: report.archiveEntry, pdfPages: report.pdfPages },
      requestId,
      source: "TJSP_CAC_ASSISTED",
    });
    return response;
  } catch (error) {
    if (error instanceof Response) return error;
    if (tenant && captureSessionId) {
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "SOURCE_IMPORT_FAILED",
        entityType: "assisted_capture_session",
        entityId: captureSessionId,
        previousStateSummary: { status: "FILE_RECEIVED" },
        nextStateSummary: { status: "FAILED" },
        metadata: { sourceFileName, sourceFileChecksum, sourceUrl: CAC_URL, captureMode: "ASSISTED", reason: error instanceof Error ? error.message.slice(0, 300) : "Erro de processamento" },
        requestId,
        source: "TJSP_CAC_ASSISTED",
      }).catch(() => {});
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível processar o relatório do CAC." }, { status: 400 });
  }
}
