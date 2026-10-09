type AiPilotRun = {
  id: string;
  organizationId: string;
  corpusItemIds: ReadonlySet<string>;
  createdAt: number;
};

const runs = new Map<string, AiPilotRun>();
const RUN_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RUNS = 1000;

function pruneExpired(now: number) {
  for (const [id, run] of runs) {
    if (now - run.createdAt > RUN_TTL_MS) runs.delete(id);
  }
  while (runs.size > MAX_RUNS) {
    const oldestId = runs.keys().next().value;
    if (!oldestId) break;
    runs.delete(oldestId);
  }
}

export function recordAiPilotRun(input: { id: string; organizationId: string; corpusItemIds: string[] }) {
  const now = Date.now();
  pruneExpired(now);
  runs.set(input.id, {
    id: input.id,
    organizationId: input.organizationId,
    corpusItemIds: new Set(input.corpusItemIds),
    createdAt: now,
  });
}

export function aiPilotRunOwnsItem(runId: string, organizationId: string, corpusItemId: string) {
  pruneExpired(Date.now());
  const run = runs.get(runId);
  return Boolean(run && run.organizationId === organizationId && run.corpusItemIds.has(corpusItemId));
}

export function clearAiPilotRunsForTests() {
  runs.clear();
}
