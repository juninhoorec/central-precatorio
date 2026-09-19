import { NextResponse } from "next/server";
import { globalPilotRepository, pilotCorpusItemSchema, goldAnnotationSchema } from "@/lib/ai/ai-pilot-corpus";

export async function GET() {
  const items = globalPilotRepository.getAll();
  return NextResponse.json({
    total: items.length,
    items
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      action?: string;
      corpusItemId?: string;
      gold?: unknown;
      id?: string;
      [key: string]: unknown;
    };
    if (body.action === "annotate_gold") {
      const { corpusItemId, gold } = body;
      const updated = globalPilotRepository.annotateGold(corpusItemId ?? "", gold as never);
      return NextResponse.json({ ok: true, item: updated });
    }
    const item = pilotCorpusItemSchema.parse({
      ...body,
      id: body.id || crypto.randomUUID(),
      createdAt: new Date().toISOString()
    });
    const saved = globalPilotRepository.save(item);
    return NextResponse.json({ ok: true, item: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to process pilot corpus request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
