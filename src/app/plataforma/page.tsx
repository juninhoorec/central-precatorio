import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, ChartNoAxesCombined, CircleGauge, Files, Megaphone, Network, ShieldCheck } from "lucide-react";
import { Footer, Header } from "../page";

const modules = [
  ["CP Intake", "Disponível", "Captação consentida, origem da campanha, pré-qualificação e score inicial.", CircleGauge],
  ["CP Pipeline", "Beta autenticado", "Contas individuais, organizações isoladas, operações persistentes, agenda e tarefas.", BriefcaseBusiness],
  ["Deal Economics", "Beta público", "Cenários configuráveis de preço, custos, prazo, margem e retorno anualizado.", ChartNoAxesCombined],
  ["CP Deal Room", "Beta autenticado", "PDFs isolados por organização, downloads restritos, integridade e checklist.", Files],
  ["CP Match", "Roadmap", "Distribuição consentida por tese, região, capacidade, SLA e critérios transparentes.", Network],
  ["CP Growth", "Roadmap", "Campanhas, conteúdo cooperado, atribuição e qualidade comercial em um só painel.", Megaphone],
] as const;

export default function Page() {
  return <><Header /><main className="platform-page">
    <section className="platform-hero shell"><div>
      <span className="kicker">CENTRAL OPERACIONAL PARA PRECATÓRIOS</span>
      <h1>Da oportunidade ao acompanhamento, <em>sem depender de planilhas soltas.</em></h1>
      <p>O CP está evoluindo para conectar titulares, empresas e especialistas em uma infraestrutura única de aquisição, qualificação, análise e colaboração.</p>
      <div className="actions"><Link className="btn primary" href="/conta">Acessar minha organização <ArrowRight /></Link><Link className="btn ghost" href="/economia-operacao">Testar Deal Economics</Link></div>
    </div><div className="platform-console"><div className="console-top"><span>CP OPPORTUNITY OS</span><b>VISÃO DO PIPELINE</b></div>
      {["Entrada qualificada", "Pré-análise", "Documentação", "Proposta", "Formalização"].map((x,i)=><div className="console-line" key={x}><span>{String(i+1).padStart(2,"0")}</span><b>{x}</b><i style={{width:`${92-i*12}%`}} /></div>)}
    </div></section>
    <section className="platform-modules shell"><div className="section-head"><span className="kicker">ARQUITETURA MODULAR</span><h2>Valor agora. Evolução sem promessas disfarçadas.</h2><p>O status de cada recurso é público para que parceiros saibam exatamente o que já existe.</p></div><div className="module-grid">{modules.map(([title,status,text,Icon])=><article key={title}><div><Icon/><span className={status === "Roadmap" ? "status future" : "status"}>{status}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="growth-engine"><div className="shell growth-grid"><div><span className="kicker light">DIFERENCIAL CP GROWTH</span><h2>Marketing que mede qualidade, não apenas volume.</h2><p>Parceiros poderão competir por relevância por meio de cobertura, capacidade, tempo de resposta, experiência e satisfação — com critérios visíveis e sem vender prioridade escondida.</p></div><div className="growth-list"><p><BadgeCheck/>Origem e consentimento rastreáveis</p><p><BarChart3/>Custo por oportunidade e por avanço</p><p><ShieldCheck/>Regras de elegibilidade e reputação</p><p><Megaphone/>Conteúdo e campanhas cooperadas</p></div></div></section>
    <section className="principles shell"><span className="kicker">PRINCÍPIOS DO PRODUTO</span><div><article><b>01</b><h3>Fonte oficial primeiro</h3><p>O CP orienta consultas nos portais dos tribunais e registra a fonte de cada dado.</p></article><article><b>02</b><h3>Humano no controle</h3><p>Automação organiza; análise jurídica, tributária e decisão permanecem com especialistas.</p></article><article><b>03</b><h3>Consentimento e auditabilidade</h3><p>Compartilhamento, mudanças de etapa e acesso a documentos devem deixar histórico.</p></article></div></section>
  </main><Footer /></>;
}
