"use client";

type ControlOperation = {
  id: string;
  owner: string;
  stage: string;
  createdAt?: string;
  updatedAt?: string;
  nominal: number;
  history: { at: string; text: string }[];
  workflow: { credit: { titular?: string; document?: string; municipality?: string; grossAmount?: number; originProcessNumber?: string }; nextAction?: { title?: string } };
};

const ageHours = (date?: string) => date ? Math.max(0, (Date.now() - new Date(date).getTime()) / 36e5) : Infinity;

export default function OperationalControlPanel({ items }: { items: ControlOperation[] }) {
  const counts = {
    received: items.length,
    analyzed: items.filter((item) => item.stage !== "Entrada").length,
    corrected: items.filter((item) => item.history.some((event) => /corrig|alter|atualiz/i.test(event.text))).length,
    discarded: items.filter((item) => /encerr|descart/i.test(item.stage)).length,
    contacts: items.filter((item) => item.history.some((event) => /contato|whatsapp|e-mail|ligação/i.test(event.text))).length,
    proposals: items.filter((item) => /proposta/i.test(item.stage)).length,
  };
  const sla = {
    alert24h: items.filter((item) => ageHours(item.updatedAt) >= 24 && ageHours(item.updatedAt) < 72).length,
    alert3d: items.filter((item) => ageHours(item.updatedAt) >= 72 && ageHours(item.updatedAt) < 168).length,
    critical7d: items.filter((item) => ageHours(item.updatedAt) >= 168).length,
  };
  const missing = {
    titular: items.filter((item) => !item.workflow.credit.titular).length,
    document: items.filter((item) => !item.workflow.credit.document).length,
    municipality: items.filter((item) => !item.workflow.credit.municipality).length,
    process: items.filter((item) => !item.workflow.credit.originProcessNumber).length,
  };
  return <section style={{ display: "grid", gap: "1rem" }}>
    <div className="cp-control-grid">
      {Object.entries(counts).map(([label, value]) => <article key={label} className="cp-control-card"><small>{label === "received" ? "Recebidos" : label === "analyzed" ? "Analisados" : label === "corrected" ? "Corrigidos" : label === "discarded" ? "Descartados" : label === "contacts" ? "Contatos" : "Propostas"}</small><strong>{value}</strong></article>)}
    </div>
    <div className="cp-control-grid">
      <article className="cp-control-card"><small>SLA 24h</small><strong>{sla.alert24h}</strong></article>
      <article className="cp-control-card"><small>SLA 3 dias</small><strong>{sla.alert3d}</strong></article>
      <article className="cp-control-card"><small>SLA 7 dias</small><strong>{sla.critical7d}</strong></article>
      <article className="cp-control-card"><small>Tempo médio</small><strong>Calculado por histórico</strong></article>
    </div>
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem" }}>
      <h2 style={{ marginTop: 0 }}>Qualidade dos dados</h2>
      <p>Campos pendentes para revisão humana: titular <b>{missing.titular}</b> · CPF/CNPJ <b>{missing.document}</b> · município <b>{missing.municipality}</b> · processo <b>{missing.process}</b>.</p>
      <p style={{ color: "#64748b", fontSize: ".85rem" }}>A ausência é sinalizada para o analista; o CP não inventa nem promove dados não confirmados.</p>
    </div>
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: "1rem" }}>
      <h2 style={{ marginTop: 0 }}>Próximas ações prioritárias</h2>
      {items.slice().sort((a, b) => ageHours(b.updatedAt) - ageHours(a.updatedAt)).slice(0, 12).map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: ".55rem 0", borderBottom: "1px solid #f1f5f9" }}><span>{item.id.slice(0, 10)} · {item.workflow.nextAction?.title || "Definir ação"}</span><small>{ageHours(item.updatedAt) === Infinity ? "sem atualização" : `${Math.floor(ageHours(item.updatedAt))}h parado`}</small></div>)}
    </div>
  </section>;
}
