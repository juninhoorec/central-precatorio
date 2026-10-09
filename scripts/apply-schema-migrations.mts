import { applySchemaMigrations } from "../src/lib/schema-migrations";
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL_REQUIRED_FOR_SCHEMA_MIGRATION");
console.log(JSON.stringify(await applySchemaMigrations()));
