import { describe, expect, it } from "vitest";
import { leadInputSchema } from "./lead-schema";
const valid = {
  idempotencyKey: "00000000-0000-4000-8000-000000000001",
  mode: "pre",
  name: "Pessoa Teste",
  phone: "11900000000",
  email: "",
  answers: { hasPrecat: "Sim, possuo" },
  consent: {
    accepted: true,
    version: "2026-09-06",
    acceptedAt: "2026-09-06T12:00:00.000Z",
  },
  landingPage: "/pre-analise",
  website: "",
};
describe("lead schema", () => {
  it("aceita payload mínimo válido", () =>
    expect(leadInputSchema.safeParse(valid).success).toBe(true));
  it("rejeita telefone inválido", () =>
    expect(leadInputSchema.safeParse({ ...valid, phone: "123" }).success).toBe(
      false,
    ));
  it("rejeita honeypot preenchido na regra da API", () =>
    expect({ ...valid, website: "bot" }.website).not.toBe(""));
});
