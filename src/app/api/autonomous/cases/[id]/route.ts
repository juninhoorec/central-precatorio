import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantPermission } from "@/lib/tenant";
import { getOperation } from "@/lib/operations";
import { appendAudit } from "@/lib/audit";
import {
  listOfficialEvidence,
  listAcquisitionContacts,
  listAcquisitionEvents,
  recordOfficialEvidence,
  recordAcquisitionContact,
  countVerifiedOfficialEvidence,
  getAcquisitionProfile,
} from "@/lib/autonomous-acquisition";
import { isOfficialSourceUrl } from "@/lib/acquisition-sources";
import { evaluateAcquisitionReadiness } from "@/lib/lead-qualification";

export const runtime = "nodejs";

const evidenceSchema = z.object({
  documentType: z.enum([
    "OFICIO_REQUISITORIO",
    "OFICIO_COMPLEMENTAR",
    "REQUISITORIO",
    "PROCESS_DOCUMENT",
    "OFFICIAL_RECORD",
    "OTHER_OFFICIAL_DOCUMENT",
  ]),
  title: z.string().trim().min(1).max(240),
  source: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url().max(1000),
  downloadUrl: z.string().url().max(1000).or(z.literal("")).default(""),
  documentIdentifier: z.string().trim().max(240).default(""),
  reference: z.string().trim().max(500).default(""),
  sourceProvenance: z.object({
    provider: z.string().trim().min(1).max(120),
    sourceId: z.string().trim().min(1).max(160),
    route: z.string().trim().min(1).max(240),
  }).strict().nullable().optional(),
  publishedAt: z.union([z.literal(""), z.iso.date()]).default(""),
  page: z.number().int().positive().nullable().default(null),
  hash: z.string().regex(/^[a-f0-9]{64}$/i).or(z.literal("")).default(""),
  contentFingerprint: z.string().max(160).default(""),
  status: z.enum(["COLLECTED", "VERIFIED", "DIVERGENT", "FAILED"]),
  evidenceStrength: z.enum(["STRONG", "MEDIUM", "WEAK"]),
  notes: z.string().trim().max(3000).default(""),
  idempotencyKey: z.string().trim().min(8).max(200),
});

const contactSchema = z.object({
  type: z.enum(["PHONE", "MOBILE", "EMAIL", "WEBSITE", "OTHER"]),
  value: z.string().trim().min(1).max(320),
  source: z.string().trim().min(1).max(160),
  sourceUrl: z.string().url().max(1000),
  confidence: z.number().min(0).max(100),
  notes: z.string().trim().max(1000).default(""),
  idempotencyKey: z.string().trim().min(8).max(200),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:read");
    const { id } = await params;

    const operation = await getOperation(id, undefined, tenant.organizationId);
    if (!operation) {
      return NextResponse.json(
        { error: "Caso não encontrado." },
        { status: 404 },
      );
    }

    const storedOfficialEvidence = await listOfficialEvidence(
      id,
      tenant.organizationId,
    );
    const officialEvidence = storedOfficialEvidence.map((document) => ({
      ...document,
      downloadUrl:
        document.downloadUrl && isOfficialSourceUrl(document.downloadUrl)
          ? document.downloadUrl
          : "",
    }));
    const contacts = await listAcquisitionContacts(id, tenant.organizationId);
    const sourceEvents = await listAcquisitionEvents(id, tenant.organizationId);

    const verifiedCount = countVerifiedOfficialEvidence(officialEvidence);
    const profile = await getAcquisitionProfile(tenant.organizationId);

    const readiness = evaluateAcquisitionReadiness({
      creditorName: operation.workflow.client.name,
      amount: operation.nominal,
      minimumAmount: profile.minimumPrecatory,
      numeroProcessoDEPRE: operation.workflow.credit.numeroProcessoDEPRE,
      debtor: operation.debtor,
      debtorState: operation.workflow.credit.debtorState,
      tribunal: operation.tribunal,
      targetState: profile.state,
      targetTribunal: profile.tribunal,
      officialEvidenceCount: verifiedCount,
      requiredOfficialEvidence: profile.minimumOfficialEvidence,
      identityConflict:
        operation.workflow.creditorResolution.state ===
        "CONFLITO_DE_IDENTIDADE",
      contactAvailable:
        contacts.length > 0 ||
        Boolean(operation.workflow.client.phone || operation.workflow.client.email),
      processNumber:
        operation.process ||
        operation.workflow.credit.originProcessNumber ||
        operation.workflow.credit.precatoryNumber,
    });

    const summaryText = {
      header: "OPPORTUNITY SUMMARY",
      creditor: operation.workflow.client.name || "Não identificado",
      value: operation.nominal,
      depre:
        operation.workflow.credit.numeroProcessoDEPRE ||
        "Não identificado na fonte consultada",
      process:
        operation.process ||
        operation.workflow.credit.originProcessNumber ||
        operation.workflow.credit.precatoryNumber ||
        "",
      debtor: operation.debtor || "Não informado",
      nature: operation.workflow.credit.nature || "Não informada",
      contact: contacts.map((c) => ({
        type: c.type,
        value: c.value,
        source: c.source,
        sourceUrl: c.sourceUrl,
        collectedAt: c.collectedAt,
        label: "Contato localizado",
      })),
      officialEvidenceCount: `${verifiedCount}/${profile.minimumOfficialEvidence}`,
      primarySource: officialEvidence[0]?.source || operation.source,
      referenceDate: operation.workflow.credit.valueDate || "",
      lastUpdated: operation.workflow.credit.checkedAt || "",
      identityConfidence: operation.workflow.creditorResolution.confidence,
      conflicts: readiness.reasons.filter((r) => r === "IDENTITY_CONFLICT"),
      status: readiness.state,
      nextAction: readiness.nextAction,
      evidenceLinks: officialEvidence
        .filter(
          (doc) =>
            doc.status === "VERIFIED" &&
            isOfficialSourceUrl(doc.sourceUrl) &&
            Boolean(doc.documentIdentifier.trim() || doc.reference.trim()),
        )
        .map((doc) => ({
          title: doc.title,
          sourceUrl: doc.sourceUrl,
          downloadUrl:
            doc.downloadUrl && isOfficialSourceUrl(doc.downloadUrl)
              ? doc.downloadUrl
              : null,
        })),
    };

    return NextResponse.json(
      {
        operation,
        officialEvidence,
        contacts,
        sourceEvents,
        readiness,
        summaryText,
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Não foi possível carregar os detalhes do caso.",
      },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const tenant = await requireTenantPermission(request.headers, "operation:write");
    const { id } = await params;
    const body = await request.json();

    if (body.documentType) {
      const parsed = evidenceSchema.parse(body);
      const recorded = await recordOfficialEvidence({
        ...parsed,
        operationId: id,
        organizationId: tenant.organizationId,
      });
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "OFFICIAL_EVIDENCE_RECORDED",
        entityType: "official_evidence_document",
        entityId: recorded.id,
        previousStateSummary: {},
        nextStateSummary: {
          status: recorded.status,
          evidenceStrength: recorded.evidenceStrength,
          documentType: recorded.documentType,
        },
        metadata: {
          operationId: id,
          source: recorded.source,
          sourceUrl: recorded.sourceUrl,
          sourceProvenance: recorded.sourceProvenance ? JSON.stringify(recorded.sourceProvenance) : null,
          downloadUrlProvided: Boolean(recorded.downloadUrl),
        },
        requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        source: "AUTONOMOUS_ACQUISITION",
      });
      return NextResponse.json(
        { type: "evidence", recorded },
        { headers: { "cache-control": "no-store" } },
      );
    } else if (body.type && body.value) {
      const parsed = contactSchema.parse(body);
      const recorded = await recordAcquisitionContact({
        ...parsed,
        operationId: id,
        organizationId: tenant.organizationId,
      });
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "CONTACT_ENRICHED",
        entityType: "acquisition_contact",
        entityId: recorded.id,
        previousStateSummary: {},
        nextStateSummary: { type: recorded.type, source: recorded.source },
        metadata: { operationId: id, sourceUrl: recorded.sourceUrl },
        requestId: request.headers.get("x-request-id") || crypto.randomUUID(),
        source: "AUTONOMOUS_ACQUISITION",
      });
      return NextResponse.json(
        { type: "contact", recorded },
        { headers: { "cache-control": "no-store" } },
      );
    } else {
      return NextResponse.json(
        { error: "Payload inválido para documento oficial ou contato." },
        { status: 400 },
      );
    }
  } catch (e) {
    if (e instanceof Response) return e;
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Não foi possível gravar o registro.",
      },
      { status: 400 },
    );
  }
}
