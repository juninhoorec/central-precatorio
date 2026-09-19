import {createClient} from "@libsql/client";
import {describe,expect,it} from "vitest";
import {beginImport,finishImport,listImportBatches} from "./capture-imports";

describe("capture import batches",()=>{
 it("persists report and makes a repeated identical snapshot idempotent per organization",async()=>{
  const db=createClient({url:":memory:"}),bytes=new TextEncoder().encode("synthetic-list");
  const input={organizationId:"org-a",userId:"user-a",sourceId:"tjsp-lista-geral",sourceName:"TJSP · Lista Geral",fileName:"lista.csv",sourceReference:"https://example.invalid/list",bytes};
  const first=await beginImport(input,db);expect(first.duplicate).toBe(false);
  await finishImport(first.batch.id,"org-a","COMPLETED_WITH_WARNINGS",{read:3,created:1,updated:0,duplicates:1,conflicts:1,rpvs:0,skipped:0,belowMinimum:0,incomplete:0,errors:0},[],db);
  const repeated=await beginImport(input,db);expect(repeated.duplicate).toBe(true);expect(repeated.batch.summary.conflicts).toBe(1);
  const otherOrg=await beginImport({...input,organizationId:"org-b"},db);expect(otherOrg.duplicate).toBe(false);
  expect((await listImportBatches("org-a",db))).toHaveLength(1);expect((await listImportBatches("org-b",db))).toHaveLength(1);db.close();
 });
});
