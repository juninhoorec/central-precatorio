import { NextResponse } from "next/server";
import { globalPilotRepository } from "@/lib/ai/ai-pilot-corpus";
import { runPilotEvaluation } from "@/lib/ai/ai-evaluator";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const promptVersion = url.searchParams.get("promptVersion") || "v1";
  const items = globalPilotRepository.getAll();
  const scorecard = await runPilotEvaluation(items, promptVersion);
  return NextResponse.json(scorecard);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { promptVersion?: string };
    const promptVersion = body.promptVersion || "v1";
    const items = globalPilotRepository.getAll();
    const scorecard = await runPilotEvaluation(items, promptVersion);
    return NextResponse.json(scorecard);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute AI evaluation";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
