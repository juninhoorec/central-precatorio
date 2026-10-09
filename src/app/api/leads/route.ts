import { NextResponse } from "next/server";
import { leadInputSchema } from "@/lib/lead-schema";
import { saveLead } from "@/lib/lead-repository";
import { scoreLabel } from "@/lib/lead-score";
import { scoreAnswers } from "@/lib/score-lead";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-validation";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!(await rateLimit(request, "leads", 8)))
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde alguns minutos." },
      { status: 429 },
    );
  const body = await readJsonBody(request, 16 * 1024);
  if (!body.ok)
    return NextResponse.json(
      { error: body.reason === "too_large" ? "O formulário excede o limite permitido." : "Revise os dados informados." },
      { status: body.reason === "too_large" ? 413 : 400 },
    );
  const parsed = leadInputSchema.safeParse(body.value);
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
