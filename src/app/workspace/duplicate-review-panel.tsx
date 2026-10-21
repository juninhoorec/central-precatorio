"use client";

import { useMemo, useState } from "react";

type Item = { id: string; title: string; workflow: { credit: { numeroProcessoDEPRE?: string; originProcessNumber?: string } } };

export default function DuplicateReviewPanel({ items }: { items: Item[] }) {
  const [decisions, setDecisions] = useState<Record<string, "APROVADA" | "IGNORADA">>({});
  const suggestions = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const item of items) {
      const key = item.workflow.credit.numeroProcessoDEPRE || item.workflow.credit.originProcessNumber;
      if (!key) continue;
      const group = groups.get(key) || [];
      group.push(item);
      groups.set(key, group);
    }
    return [...groups.entries()].filter(([, group]) => group.length > 1).map(([key, group]) => ({ key, group }));
  }, [items]);
  return <section style={{ display: "grid", gap: "1rem" }}>
    <div style={{ padding: "1rem", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10 }}><b>Revisão humana obrigatória</b><p style={{ marginBottom: 0 }}>O CP apenas sugere a possível duplicidade. Nenhum registro é unido automaticamente.</p></div>
    {suggestions.length === 0 ? <p>Nenhuma sugestão de duplicidade nos registros carregados.</p> : suggestions.map(({ key, group }) => <article key={key} style={{ border: "1px solid #e2e8f0", borderRadius: 10, padding: "1rem" }}><strong>{key}</strong>{group.map((item) => <p key={item.id} style={{ margin: ".5rem 0" }}>{item.id} · {item.title}</p>)}<small>Decisão: {decisions[key] || "PENDENTE"}</small><div style={{ display: "flex", gap: ".5rem", marginTop: ".75rem" }}><button onClick={() => setDecisions((v) => ({ ...v, [key]: "APROVADA" }))}>Aprovar união</button><button onClick={() => setDecisions((v) => ({ ...v, [key]: "IGNORADA" }))}>Manter separados</button></div></article>)}
  </section>;
}
