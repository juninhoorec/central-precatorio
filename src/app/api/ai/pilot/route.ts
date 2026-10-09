import { NextResponse } from "next/server";
import { z } from "zod";
import {
  globalPilotRepository,
  goldAnnotationSchema,
  pilotCorpusItemSchema,
  pilotScenarioTypes,
  sourceOriginTypeSchema,
} from "@/lib/ai/ai-pilot-corpus";
import { appendAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { requireSameOrigin, requireTenantPermission } from "@/lib/tenant";
import { readJsonBody } from "@/lib/request-validation";

const createItemSchema = z.object({
  title: z.string().trim().min(3).max(240),
  sourceOriginType: sourceOriginTypeSchema,
  scenarioType: z.enum(pilotScenarioTypes),
  documentText: z.string().max(100_000),
  depre: z.string().trim().max(64).optional(),
  originProcess: z.string().trim().max(64).optional(),
  debtor: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2_000).optional(),
}).strict();
const goldInputSchema = goldAnnotationSchema.omit({
  id: true,
  corpusItemId: true,
  annotatedBy: true,
  annotatedAt: true,
  version: true,
}).strict();
const annotateSchema = z.object({ action: z.literal("annotate_gold"), corpusItemId: z.uuid(), gold: goldInputSchema }).strict();

export async function GET(request: Request) {
  try {
    const tenant = await requireTenantPermission(request.headers, "ai:pilot:read");
    const items = globalPilotRepository.getAll(tenant.organizationId);
    return NextResponse.json({ total: items.length, items }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível consultar o corpus de avaliação." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    requireSameOrigin(req);
    const tenant = await requireTenantPermission(req.headers, "ai:pilot:write");
    if (!(await rateLimit(req, "ai-pilot-write", 10, 600, `${tenant.organizationId}:${tenant.userId}`))) {
      return NextResponse.json({ error: "Limite de alterações do piloto atingido." }, { status: 429 });
    }
    const bodyContent = await readJsonBody(req, 128 * 1024);
    if (!bodyContent.ok) return NextResponse.json({ error: bodyContent.reason === "too_large" ? "Payload excede o limite." : "JSON inválido." }, { status: bodyContent.reason === "too_large" ? 413 : 400 });
    const raw = bodyContent.value;
    const action = z.object({ action: z.string().optional() }).passthrough().safeParse(raw);
    if (!action.success) return NextResponse.json({ error: "Payload inválido." }, { status: 400 });

    if (action.data.action === "annotate_gold") {
      const parsed = annotateSchema.safeParse(raw);
      if (!parsed.success) return NextResponse.json({ error: "Anotação inválida." }, { status: 400 });
      const current = globalPilotRepository.getById(parsed.data.corpusItemId, tenant.organizationId);
      if (!current) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
      const gold = goldAnnotationSchema.parse({
        ...parsed.data.gold,
        id: crypto.randomUUID(),
        corpusItemId: current.id,
        annotatedBy: tenant.userId,
        annotatedAt: new Date().toISOString(),
        version: (current.goldAnnotation?.version ?? 0) + 1,
      });
      const updated = globalPilotRepository.annotateGold(current.id, gold, tenant.organizationId);
      await appendAudit({
        organizationId: tenant.organizationId,
        actorUserId: tenant.userId,
        action: "AI_PILOT_GOLD_ANNOTATED",
        entityType: "ai_pilot_corpus_item",
        entityId: current.id,
        previousStateSummary: { status: current.status },
        nextStateSummary: { status: updated.status, annotationVersion: gold.version },
        metadata: {},
        requestId: req.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
        source: "AI_PILOT_API",
      });
      return NextResponse.json({ ok: true, item: updated }, { headers: { "cache-control": "no-store" } });
    }

    const parsed = createItemSchema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "Item de avaliação inválido." }, { status: 400 });
    const item = pilotCorpusItemSchema.parse({
      ...parsed.data,
      organizationId: tenant.organizationId,
      id: crypto.randomUUID(),
      isRegressionSet: false,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    });
    const saved = globalPilotRepository.save(item);
    await appendAudit({
      organizationId: tenant.organizationId,
      actorUserId: tenant.userId,
      action: "AI_PILOT_ITEM_CREATED",
      entityType: "ai_pilot_corpus_item",
      entityId: saved.id,
      previousStateSummary: {},
      nextStateSummary: { status: saved.status, scenarioType: saved.scenarioType },
      metadata: {},
      requestId: req.headers.get("x-request-id")?.slice(0, 160) || crypto.randomUUID(),
      source: "AI_PILOT_API",
    });
    return NextResponse.json({ ok: true, item: saved }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error: unknown) {
    if (error instanceof Response) return error;
    return NextResponse.json({ error: "Não foi possível alterar o corpus de avaliação." }, { status: 500 });
  }
}
