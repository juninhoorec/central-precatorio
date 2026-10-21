import { createClient } from "@libsql/client";
import { listOperations } from "../src/lib/operations.ts";
import { generateManualResearchBatch } from "../src/lib/manual-research.ts";

const organizationId = process.env.CP_IMPORT_ORGANIZATION_ID || "legacy-internal";
const actorUserId = process.env.CP_IMPORT_ACTOR || "research-907-queue";
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });

const operations = (await listOperations(client, organizationId)).filter((operation) =>
  !operation.isDemo && operation.source === "CP · fila consolidada de 907 candidatos",
);

const summary = await generateManualResearchBatch(
  operations.map((operation) => ({
    operationId: operation.id,
    depre: operation.workflow.credit.numeroProcessoDEPRE,
    blockerCodes: ["TITULAR_NOT_CONFIRMED", "DOCUMENTATION_BELOW_2_OF_2", "INSUFFICIENT_SOURCE_COVERAGE"] as const,
    sourceAttempts: [],
  })),
  organizationId,
  actorUserId,
  client,
);

console.log(JSON.stringify({
  operations: operations.length,
  tasksCreated: summary.reduce((total, item) => total + item.created, 0),
  tasksReused: summary.reduce((total, item) => total + item.reused, 0),
  failures: summary.filter((item) => item.tasks.length === 0).length,
}, null, 2));

await client.close();
