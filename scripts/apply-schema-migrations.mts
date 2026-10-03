import { applySchemaMigrations } from "../src/lib/schema-migrations";
console.log(JSON.stringify(await applySchemaMigrations()));
