import { Header, Footer } from "../page";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  ChartNoAxesCombined,
  FileSearch,
  ListChecks,
  Sparkles,
} from "lucide-react";
const items = [
  ["Mesa de operações", "Cadastros, pipeline, tarefas, documentos e propostas persistentes.", ClipboardCheck, "/workspace"],
  ["Ferramentas de negociação", "Preço máximo, comparação de ofertas e solicitações documentais.", ChartNoAxesCombined, "/ferramentas/negociacao"],
  [
    "Economia da operação",
    "Compare preço, custos, prazo, deságio e retorno projetado.",
    ChartNoAxesCombined,
    "/economia-operacao",
  ],
  [
    "Assistente do Precatório",
    "Encontre o próximo passo a partir do que você já sabe.",
    Sparkles,
    "/assistente",
  ],
  [
    "Pré-análise",
    "Organize e envie as informações iniciais do seu caso.",
    FileSearch,
    "/pre-analise",
  ],
  [
    "Simulador educativo",
    "Conheça os fatores que influenciam uma avaliação.",
    BarChart3,
    "/simulador",
  ],
  [
    "Guia de consulta",
    "Aprenda a consultar fontes oficiais com segurança.",
    ListChecks,
    "/consultar-precatorio",
  ],
  [
    "Checklist de documentos",
    "Veja o que costuma ajudar em uma análise.",
    ClipboardCheck,
    "/documentos",
  ],
] as const;
export default function Page() {
  return (
    <>
      <Header />
      <main className="listing">
        <div className="shell">
          <span className="kicker">CENTRAL DE FERRAMENTAS</span>
          <h1>
            Informação para você
            <br />
            <em>avançar com clareza.</em>
          </h1>
          <p>Recursos gratuitos e simples. Escolha por onde deseja começar.</p>
          <div className="listing-grid">
            {items.slice(3).map(([title, description, Icon, href]) => (
              <Link href={href} key={title}>
                <Icon />
                <h2>{title}</h2>
                <p>{description}</p>
                <span>
                  Acessar ferramenta <ArrowRight />
                </span>
              </Link>
            ))}
          </div>
          <div className="section-head"><span className="kicker">PARA EMPRESAS E ESPECIALISTAS</span><h2>Ferramentas para organizar a operação.</h2><p>Cálculos educativos abertos. A mesa de trabalho tem acesso interno restrito.</p></div>
          <div className="listing-grid">{items.slice(0,3).map(([title,description,Icon,href])=><Link href={href} key={title}><Icon/><h2>{title}</h2><p>{description}</p><span>Acessar ferramenta <ArrowRight/></span></Link>)}</div>
        </div>
      </main>
      <Footer />
    </>
  );
}
