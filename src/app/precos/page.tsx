import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Footer, Header } from "../page";

const plans = [
  { name: "Especialista", audience: "1 profissional", monthly: "R$ 497", annual: "R$ 4.970", note: "equivale a R$ 414/mês", features: ["1 usuário", "Até 100 oportunidades ativas", "Pipeline e tarefas", "Deal Economics", "Diligência e histórico"], cta: "Quero o plano Especialista", featured: false },
  { name: "Equipe", audience: "4 a 6 colaboradores", monthly: "R$ 1.490", annual: "R$ 14.900", note: "equivale a R$ 1.242/mês", features: ["Até 6 usuários", "Até 500 oportunidades ativas", "Responsáveis e SLAs", "Permissões por função", "Relatórios e exportações"], cta: "Quero o plano Equipe", featured: true },
  { name: "Empresa", audience: "10 ou mais colaboradores", monthly: "A partir de R$ 3.490", annual: "A partir de R$ 34.900", note: "10 usuários; volume sob diagnóstico", features: ["10 usuários incluídos", "Múltiplas equipes e teses", "Auditoria e governança", "Integrações e implantação", "Suporte operacional dedicado"], cta: "Solicitar diagnóstico", featured: false },
] as const;

export const metadata = { title: "Planos e preços", description: "Planos propostos para especialistas e empresas operarem oportunidades em precatórios no CP." };

export default function Page() {
  return <><Header/><main className="pricing-page"><section className="pricing-hero shell"><span className="kicker">PREÇOS PROPOSTOS PARA O LANÇAMENTO</span><h1>Estrutura para operar.<br/><em>Preço para crescer.</em></h1><p>Valores de referência para a versão transacional após o piloto. Durante o MVP, recomendamos oferecer condições de fundador em troca de feedback e validação operacional.</p></section>
  <section className="pricing-grid shell">{plans.map((plan)=><article className={plan.featured ? "featured" : ""} key={plan.name}>{plan.featured && <span className="pricing-badge">MAIS INDICADO</span>}<small>{plan.audience}</small><h2>CP {plan.name}</h2><div className="price"><span>MENSAL</span><strong>{plan.monthly}</strong><small>/mês</small></div><div className="annual"><span>ANUAL</span><b>{plan.annual}</b><small>{plan.note}</small></div><ul>{plan.features.map(f=><li key={f}><Check/>{f}</li>)}</ul><Link className="btn primary" href="/parceiros">{plan.cta}<ArrowRight/></Link></article>)}</section>
  <section className="pricing-rationale shell"><div><span className="kicker">COMO CHEGAMOS A ESSES VALORES</span><h2>O CP não concorre apenas com um CRM.</h2></div><p>O valor considera uma camada vertical de precatórios: intake, contexto, consentimento, diligência, economia da operação, propostas e auditoria. A cobrança recomendada é assinatura fixa, sem percentual sobre a operação nesta fase. Usuários, armazenamento, KYC, assinatura e integrações podem virar adicionais quando os custos reais forem conhecidos.</p></section>
  <section className="founder-offer"><div className="shell"><div><span className="kicker light">PROGRAMA FUNDADORES CP</span><h2>Primeiras operações com implantação acompanhada.</h2><p>Uma turma piloto pequena permite testar produto, suporte e disposição a pagar antes da tabela definitiva.</p></div><Link className="btn white" href="/parceiros">Quero participar do piloto <ArrowRight/></Link></div></section></main><Footer/></>;
}
