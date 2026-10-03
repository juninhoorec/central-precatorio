"use client";
import { useEffect, useState } from "react";
type RecordItem = { id: string; operationId: string; stage: string; updatedAt: string };
const stages = ["NEW", "QUALIFICATION", "CONTACT_PENDING", "CONTACTED", "FOLLOW_UP", "NEGOTIATION", "WON", "LOST", "ON_HOLD"];
export default function CrmPage() {
  const [items, setItems] = useState<RecordItem[]>([]); const [operationId, setOperationId] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const reload = async () => { const response = await fetch("/api/crm", { cache: "no-store" }); if (!response.ok) throw new Error("CRM indisponível"); setItems(await response.json() as RecordItem[]); };
  useEffect(() => { const timer = window.setTimeout(() => { void reload().catch((e: Error) => setError(e.message)); }, 0); return () => window.clearTimeout(timer); }, []);
  const mutate = async (body: Record<string, unknown>) => { setBusy(true); setError(""); try { const response = await fetch("/api/crm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); if (!response.ok) throw new Error("Ação CRM não autorizada ou inválida."); await reload(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); } finally { setBusy(false); } };
  return <main style={{ padding: 32, maxWidth: 1100, margin: "0 auto" }}>
    <h1>CRM operacional</h1>
    <p>Pipeline derivado de operações e oportunidades. Dados de origem permanecem preservados.</p>
    <section style={{ display: "flex", gap: 8, alignItems: "end", marginBottom: 16 }}>
      <label>ID da operação<input aria-label="ID da operação" value={operationId} disabled={busy} onChange={(event) => setOperationId(event.target.value)} /></label>
      <button type="button" disabled={busy || !operationId.trim()} onClick={() => void mutate({ action: "create", id: crypto.randomUUID(), operationId: operationId.trim() })}>Criar registro CRM</button>
    </section>
    {error && <p role="alert">{error}</p>}
    <section style={{ display: "grid", gap: 12 }}>
      {items.map((item) => <article key={item.id} style={{ border: "1px solid #dce4e8", borderRadius: 10, padding: 16 }}>
        <strong>{item.id}</strong>
        <div>Operação: {item.operationId}</div>
        <label>Estágio <select value={item.stage} disabled={busy} onChange={(event) => void mutate({ action: "stage", id: item.id, stage: event.target.value, reason: "Alteração operacional registrada pelo usuário" })}>
          {stages.map((stage) => <option key={stage}>{stage}</option>)}
        </select></label>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button type="button" disabled={busy} onClick={() => void mutate({ action: "activity", id: crypto.randomUUID(), crmId: item.id, type: "CALL_COMPLETED", notes: "Contato concluído pelo operador" })}>Registrar contato concluído</button>
          <button type="button" disabled={busy} onClick={() => void mutate({ action: "task", id: crypto.randomUUID(), crmId: item.id, title: "Revisar próximo passo", description: "Tarefa criada pelo operador", idempotencyKey: `follow-up-${item.id}` })}>Criar tarefa</button>
          <button type="button" disabled={busy} onClick={() => void mutate({ action: "activity", id: crypto.randomUUID(), crmId: item.id, type: "NOTE", notes: "Nota operacional registrada pelo usuário" })}>Registrar nota</button>
        </div>
        <small>Atualizado: {new Date(item.updatedAt).toLocaleString("pt-BR")}</small>
      </article>)}
      {!items.length && !error && <p>Nenhum registro CRM encontrado.</p>}
    </section>
  </main>;
}
