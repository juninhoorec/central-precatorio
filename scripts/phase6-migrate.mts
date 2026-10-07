import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { applySchemaMigrations } from "../src/lib/schema-migrations.js";
const { createClient } = await import("@libsql/client");
const db = createClient({ url: process.env.DATABASE_URL || "file:central-precatorios.db", authToken: process.env.DATABASE_AUTH_TOKEN });
const result = await applySchemaMigrations(db);
console.log("Applied migrations:", JSON.stringify(result, null, 2));
await db.close();
