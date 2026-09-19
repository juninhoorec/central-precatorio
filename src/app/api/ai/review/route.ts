import { NextResponse } from "next/server";
import { globalHumanReviewStore, humanReviewRecordSchema } from "@/lib/ai/ai-human-review";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const corpusItemId = url.searchParams.get("corpusItemId");
  if (corpusItemId) {
    return NextResponse.json({ reviews: globalHumanReviewStore.getForCorpusItem(corpusItemId) });
  }
  return NextResponse.json({ reviews: globalHumanReviewStore.getAll() });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; [key: string]: unknown };
    const record = humanReviewRecordSchema.parse({
      ...body,
      id: body.id || crypto.randomUUID(),
      reviewedAt: new Date().toISOString()
    });
    const saved = globalHumanReviewStore.recordReview(record);
    return NextResponse.json({ ok: true, review: saved });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to record human review";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
