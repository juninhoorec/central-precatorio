import { createClient } from "@libsql/client";
import { listOperations } from "../src/lib/operations.ts";
import { executePhase5EnrichmentForCase } from "../src/lib/official-enrichment.ts";

const organizationId = process.env.CP_IMPORT_ORGANIZATION_ID || "legacy-internal";
const actorUserId = process.env.CP_IMPORT_ACTOR || "official-enrichment-907";
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const operations = (await listOperations(client, organizationId)).filter((operation) => !operation.isDemo && operation.source === "CP · fila consolidada de 907 candidatos");
const summary = { total: operations.length, completed: 0, errors: 0, bySourceStatus: {} as Record<string, number>, ready: 0, qualifyingEvidence: 0 };

for (const [index, operation] of operations.entries()) {
  try {
    const result = await executePhase5EnrichmentForCase({ operationId: operation.id, organizationId, depre: operation.workflow.credit.numeroProcessoDEPRE, actorUserId }, client);
    summary.completed += 1;
    summary.bySourceStatus[result.sourceStatus] = (summary.bySourceStatus[result.sourceStatus] || 0) + 1;
    if (result.readyForAnalyst) summary.ready += 1;
    summary.qualifyingEvidence += result.qualifyingEvidenceCount;
  } catch (error) {
    summary.errors += 1;
    console.error(JSON.stringify({ index: index + 1, operationId: operation.id, error: error instanceof Error ? error.message : String(error) }));
  }
  if ((index + 1) % 25 === 0) console.error(JSON.stringify({ progress: index + 1, ...summary }));
}

console.log(JSON.stringify(summary, null, 2));
await client.close();
