import { createClient } from "@libsql/client";
import { describe, expect, it } from "vitest";
import {
  createOperation,
  listOperations,
  operationTaskSchema,
  updateOperation,
} from "./operations";

function input(title: string) {
  return {
    title,
    debtor: "Estado de São Paulo",
    tribunal: "TJSP",
    process: "0000000-00.2026.8.26.0000",
    owner: "Equipe CP",
    source: "Indicação",
  };
}

describe("operations repository", () => {
  it("rejeita datas de calendário inválidas", () => {
    expect(
      operationTaskSchema.safeParse({
        id: crypto.randomUUID(),
        title: "Prazo inválido",
        due: "2026-99-99",
        done: false,
      }).success,
    ).toBe(false);
  });

  it("persiste defaults e isola cada operação", async () => {
    const db = createClient({ url: ":memory:" });
    const first = await createOperation(input("Caso A"), db);
    const second = await createOperation(input("Caso B"), db);
    const listed = await listOperations(db);
    expect(listed).toHaveLength(2);
    expect(first.id).not.toBe(second.id);
    expect(first.version).toBe(1);
    expect(first.stage).toBe("Entrada");
    expect(first.tasks).toEqual([]);
    expect(listed.find((item) => item.id === second.id)?.title).toBe("Caso B");
    db.close();
  });

  it("atualiza atomicamente, gera histórico e detecta conflito", async () => {
    const db = createClient({ url: ":memory:" });
    const original = await createOperation(input("Caso concorrente"), db);
    const injectedHistory = [
      ...original.history,
      { at: new Date().toISOString(), text: "Evento arbitrário do cliente" },
    ];
    const result = await updateOperation(
      { ...original, stage: "Diligência", notes: "Conferido", history: injectedHistory },
      db,
    );
    expect(result.status).toBe("updated");
    if (result.status !== "updated") throw new Error("update failed");
    expect(result.operation.version).toBe(2);
    expect(result.operation.history).toHaveLength(2);
    expect(result.operation.history.at(-1)?.text).toContain("etapa");
    expect(result.operation.history.some((item) => item.text.includes("arbitrário"))).toBe(false);

    const conflict = await updateOperation(
      { ...original, owner: "Outro responsável" },
      db,
    );
    expect(conflict.status).toBe("conflict");
    if (conflict.status === "conflict") {
      expect(conflict.operation.version).toBe(2);
      expect(conflict.operation.owner).toBe("Equipe CP");
    }
    const persisted = await listOperations(db);
    expect(persisted[0].stage).toBe("Diligência");
    db.close();
  });

  it("aceita cadastro progressivo e limita o histórico gerado", async () => {
    const db = createClient({ url: ":memory:" });
    const created = await createOperation(
      {
        title: "Nova operação",
        debtor: "",
        tribunal: "",
        process: "",
        owner: "",
        source: "",
        tasks: [
          { id: crypto.randomUUID(), title: "Definir responsável", due: "", done: false },
        ],
        proposals: [
          {
            id: crypto.randomUUID(),
            buyer: "Comprador sandbox",
            price: 1,
            costs: 0,
            months: 1,
            receipt: 1,
            validUntil: "2026-09-30",
            conditions: "",
          },
        ],
      },
      db,
    );
    await db.execute({
      sql: "UPDATE operations SET history = ? WHERE id = ?",
      args: [
        JSON.stringify(
          Array.from({ length: 1_000 }, (_, index) => ({
            at: "2026-09-07T12:00:00.000Z",
            text: `Evento ${index}`,
          })),
        ),
        created.id,
      ],
    });
    const current = (await listOperations(db))[0];
    const result = await updateOperation({ ...current, notes: "Atualizado" }, db);
    expect(result.status).toBe("updated");
    if (result.status === "updated") expect(result.operation.history).toHaveLength(1_000);
    db.close();
  });
});
