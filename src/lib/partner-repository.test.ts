import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import { PARTNER_CONSENT_VERSION, savePartner } from "./partner-repository";

describe("partner repository", () => {
  it("persiste prova de consentimento e preserva idempotência", async () => {
    const db = createClient({ url: ":memory:" });
    const input = { idempotencyKey: crypto.randomUUID(), company: "Parceiro Teste", name: "Pessoa Teste", email: "teste@example.com", phone: "11999999999", profile: "Compra de precatórios", landingPage: "/parceiros" };
    const first = await savePartner(input, db);
    const retry = await savePartner(input, db);
    expect(retry.id).toBe(first.id);
    expect(first.consentVersion).toBe(PARTNER_CONSENT_VERSION);
    expect(Date.parse(first.consentAcceptedAt)).not.toBeNaN();
    const row = await db.execute("SELECT consent_version,consent_accepted_at FROM partners");
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].consent_version).toBe(PARTNER_CONSENT_VERSION);
    expect(row.rows[0].consent_accepted_at).toBe(first.consentAcceptedAt);
    db.close();
  });
});
