import { createClient } from "@libsql/client";
import { initializeCrm } from "../src/lib/crm-service";
import { initializeAutomation } from "../src/lib/automation-service";
const client = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
await initializeCrm(client);
await initializeAutomation(client);
console.log("FINAL_SCHEMA_INITIALIZED");
