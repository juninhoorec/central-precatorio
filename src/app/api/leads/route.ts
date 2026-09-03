import { NextResponse } from "next/server";
import { leadInputSchema } from "@/lib/lead-schema";
import { saveLead } from "@/lib/lead-repository";
import { scoreLabel } from "@/lib/lead-score";
import { scoreAnswers } from "@/lib/score-lead";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!(await rateLimit(request, "leads", 8)))
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  const parsed = leadInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success || parsed.data.website)
    return NextResponse.json(
      { error: "Revise os dados informados." },
      { status: 400 },
    );
  const score = scoreAnswers(parsed.data.answers);
  const saved = await saveLead({
    ...parsed.data,
    id: crypto.randomUUID(),
    score,
    classification: scoreLabel(score),
    createdAt: new Date().toISOString(),
    status: "NOVO",
  });
  return NextResponse.json(
    { id: saved.id, score: saved.score, classification: saved.classification },
    { status: 201 },
  );
}
