import { NextResponse } from "next/server";
import { runRealPilotExperiment } from "@/lib/ai/ai-experiment-runner";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const promptVersion = url.searchParams.get("promptVersion") || "v1";
  const experimentId = url.searchParams.get("experimentId") || "CP24-PILOT-001";
  const useRegressionOnly = url.searchParams.get("regression") === "true";

  const result = await runRealPilotExperiment({
    experimentId,
    promptVersion,
    useRegressionSetOnly: useRegressionOnly
  });

  return NextResponse.json(result);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { experimentId?: string; promptVersion?: string; regression?: boolean };
    const result = await runRealPilotExperiment({
      experimentId: body.experimentId || "CP24-PILOT-001",
      promptVersion: body.promptVersion || "v1",
      useRegressionSetOnly: Boolean(body.regression)
    });
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to execute experiment";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
