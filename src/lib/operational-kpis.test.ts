import { describe, expect, it } from "vitest";
import { createClient } from "@libsql/client";
import { calculateOperationalKpis, validateNewLot } from "./operational-kpis";

describe("operational KPI/import contracts", () => {
  it("deduplicates an identical lot without touching production records", () => {
    const result = validateNewLot(["1234567-12.2024.8.26.0500", "1234567-12.2024.8.26.0500", "0078231-59.2024.8.26.0500", "bad"], new Set(["0078231-59.2024.8.26.0500"]));
    expect(result.accepted).toEqual(["1234567-12.2024.8.26.0500"]);
    expect(result.deduplicated).toEqual(["1234567-12.2024.8.26.0500", "0078231-59.2024.8.26.0500"]);
    expect(result.rejected).toEqual(["bad"]);
  });

  it("counts only distinct verified official requisition documents toward 2/2", async () => {
    const client = createClient({ url: ":memory:" });
    await client.batch([
      "CREATE TABLE operations(id TEXT PRIMARY KEY,organization_id TEXT,is_demo INTEGER,workflow TEXT)",
      "CREATE TABLE official_evidence_documents(id TEXT,organization_id TEXT,operation_id TEXT,document_type TEXT,status TEXT,evidence_strength TEXT,source_url TEXT,document_identifier TEXT,reference TEXT,hash TEXT)",
      "CREATE TABLE crm_records(id TEXT,organization_id TEXT)",
      "CREATE TABLE crm_tasks(organization_id TEXT,status TEXT,due_at TEXT)",
      "CREATE TABLE automation_jobs(organization_id TEXT,status TEXT,error_code TEXT)",
      "INSERT INTO operations VALUES('op-a','org-a',0,'{}'),('op-b','org-a',0,'{}')",
      "INSERT INTO official_evidence_documents VALUES('a1','org-a','op-a','OFICIO_REQUISITORIO','VERIFIED','STRONG','https://www.tjsp.jus.br/a','DOC-A','REF-A','hash-a'),('a2','org-a','op-a','OFICIO_COMPLEMENTAR','VERIFIED','STRONG','https://www.tjsp.jus.br/b','DOC-B','REF-B','hash-b'),('a-duplicate','org-a','op-a','OFICIO_REQUISITORIO','VERIFIED','STRONG','https://www.tjsp.jus.br/a','DOC-A-ALT','REF-A-ALT','hash-a'),('b1','org-a','op-b','OTHER_OFFICIAL_DOCUMENT','VERIFIED','STRONG','https://www.tjsp.jus.br/c','DOC-C','REF-C','hash-c'),('b2','org-a','op-b','OTHER_OFFICIAL_DOCUMENT','VERIFIED','STRONG','https://www.tjsp.jus.br/d','DOC-D','REF-D','hash-d')",
    ], "write");

    const kpis = await calculateOperationalKpis(client, "org-a");

    expect(kpis).toMatchObject({ evidence: 5, qualifyingEvidence: 2, documentation0of2: 1, documentation1of2: 0, documentation2of2: 1, documentation3plus: 0 });
    await client.close();
  });
});
