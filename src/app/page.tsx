import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  FileSearch,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Building2,
  UserRound,
  BriefcaseBusiness,
} from "lucide-react";
import { CONTACT, whatsappUrl } from "@/lib/contact";
import TrackedLink from "@/components/TrackedLink";
import RouteHero from "@/components/RouteHero";
const steps = [
  [
    "01",
    "Conte o básico",
    "Responda algumas perguntas simples sobre o seu precatório.",
  ],
  [
    "02",
    "Receba uma orientação",
    "As informações ficam organizadas para avaliação e próximo contato.",
  ],
  [
    "03",
    "Decida com clareza",
    "Se fizer sentido, você recebe uma análise personalizada, sem compromisso.",
  ],
];
const tools = [
  [
    "Assistente do Precatório",
    "Descubra seu próximo passo em poucos minutos.",
    Sparkles,
    "/assistente",
  ],
  [
    "Pré-análise",
    "Envie as informações iniciais do seu caso.",
    FileSearch,
    "/pre-analise",
  ],
  [
    "Simulador educativo",
    "Entenda os fatores que influenciam uma análise.",
    BarChart3,
    "/simulador",
  ],
] as const;
export default function Home() {
  return (
    <>
      <a className="skip-link" href="#conteudo">
        Ir para o conteúdo
      </a>
      <Header />
      <main id="conteudo">
        <section className="hero">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <div className="eyebrow">
                <span /> PARA QUEM PENSA EM VENDER SEU PRECATÓRIO
              </div>
              <h1>
                Pensando em vender seu precatório?{" "}
                <em>Vamos conversar.</em>
              </h1>
              <p>
                Está pensando em antecipar o recebimento? Conte o que você sabe
                sobre seu caso. A Central organiza as informações para uma análise
                inicial e ajuda você a entender os próximos passos, sem compromisso de venda.
              </p>
              <div className="actions">
                <Link className="btn primary" href="/pre-analise">
                  Quero avaliar meu precatório <ArrowRight size={18} />
                </Link>
                <a className="btn ghost" href={whatsappUrl("Olá, gostaria de entender como avaliar a venda do meu precatório.")} target="_blank" rel="noopener noreferrer">Conversar com o atendimento</a>
              </div>
              <div className="trust-row">
                <span>
                  <ShieldCheck /> Coleta mínima
                </span>
                <span>
                  <BadgeCheck /> Sem compromisso
                </span>
                <span>
                  <MessageCircle /> Atendimento humano
                </span>
              </div>
            </div>
              <div className="hero-visual">
                <div className="hero-photo"><Image src="/visuals/atendimento-v2.png" alt="Cena ilustrativa de uma conversa acolhedora sobre documentos, gerada por IA" fill priority sizes="(max-width: 760px) 100vw, 50vw"/></div>
                <div className="hero-photo-badge"><ShieldCheck size={21}/><span>Você no centro<br/><b>de cada próximo passo.</b></span></div>
                <small className="hero-photo-caption">Imagem ilustrativa · não representa a equipe real</small>
                <div className="hero-contact-card"><div><small>ATENDIMENTO INICIAL</small><b>{CONTACT.initialAnalyst}</b><p>Conte seu caso. Entenda as possibilidades.<br/>Sem compromisso de venda.</p></div><Link href="/pre-analise" aria-label="Iniciar pré-análise"><ArrowRight size={20}/></Link></div>
              </div>
          </div>
        </section>
        <section className="audiences shell">
          <Link href="/pre-analise"><UserRound/><div><small>PARA TITULARES</small><b>Entender e organizar meu caso</b></div><ArrowRight/></Link>
          <Link href="/parceiros"><BriefcaseBusiness/><div><small>PARA ESPECIALISTAS</small><b>Explorar a operação de oportunidades</b></div><ArrowRight/></Link>
          <Link href="/plataforma"><Building2/><div><small>PARA EMPRESAS</small><b>Centralizar originação e análise</b></div><ArrowRight/></Link>
        </section>
        <section className="clarity">
          <div className="shell clarity-grid">
            <div>
              <span className="kicker">CLAREZA ANTES DA DECISÃO</span>
              <h2>
                Informação acessível.
                <br />
                Análise responsável.
              </h2>
            </div>
            <p>
              Precatórios envolvem tempo, documentos e decisões importantes.
              Nossa central organiza esse primeiro contato para você entender o
              caminho com tranquilidade.
            </p>
          </div>
        </section>
        <section className="steps shell" id="como">
          <div className="section-head">
            <span className="kicker">COMO FUNCIONA</span>
            <h2>
              Um processo simples,
              <br />
              do início ao próximo passo.
            </h2>
          </div>
          <div className="step-grid">
            {steps.map((s) => (
              <article key={s[0]}>
                <span>{s[0]}</span>
                <div className="step-icon">
                  <FileSearch />
                </div>
                <h3>{s[1]}</h3>
                <p>{s[2]}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="tools">
          <div className="shell">
            <div className="section-head row">
              <div>
                <span className="kicker">FERRAMENTAS GRATUITAS</span>
                <h2>Comece do seu jeito.</h2>
              </div>
              <Link href="/ferramentas">
                Ver todas as ferramentas <ArrowRight size={17} />
              </Link>
            </div>
            <div className="tool-grid">
              {tools.map(([title, description, Icon, href]) => (
                <Link href={href} className="tool-card" key={title}>
                  <Icon />
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <ArrowRight className="arr" />
                </Link>
              ))}
            </div>
          </div>
        </section>
        <section className="operating-flow shell">
          <div className="section-head" id="duvidas"><span className="kicker">ANTES DE COMEÇAR</span><h2>Suas dúvidas têm espaço aqui.</h2></div>
          <div className="step-grid">{[["Posso começar sem saber o valor?","Sim. Informe o que você souber e use a opção ‘Não sei’ quando necessário. A primeira etapa serve para organizar seu caso."],["Preciso enviar documentos agora?","Não. A pré-análise inicial não pede CPF, senha, dados bancários ou envio de documentos."],["Isso já é uma oferta de compra?","Não. A pré-análise é o primeiro contato, não uma proposta ou garantia de venda. Você decide se deseja continuar."]].map(([title,answer])=><article key={title}><h3>{title}</h3><p>{answer}</p></article>)}</div>
        </section>
        <section className="security shell" id="seguranca">
          <div className="security-mark">
            <LockKeyhole />
          </div>
          <div>
            <span className="kicker">PRIVACIDADE DESDE O PRIMEIRO CONTATO</span>
            <h2>Pedimos apenas o necessário.</h2>
            <p>
              Nesta etapa, você não precisa informar CPF, senha, dados bancários
              ou enviar documentos sensíveis.
            </p>
            <Link href="/privacidade">
              Conheça nossa política de privacidade <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="partner-callout">
          <div className="shell">
            <div>
              <span className="kicker light">
                PARA EMPRESAS E ESPECIALISTAS
              </span>
              <h2>
                Conecte sua operação a oportunidades mais bem qualificadas.
              </h2>
              <p>
                A Central está aberta a parceiros que valorizam atendimento
                responsável, transparência e acompanhamento de resultados.
              </p>
            </div>
            <Link className="btn white" href="/parceiros">
              Conhecer modelo de parceria <ArrowRight size={18} />
            </Link>
          </div>
        </section>
        <section className="cta">
          <div className="shell">
            <div>
              <span className="kicker light">PRONTO PARA COMEÇAR?</span>
              <h2>
                Entenda suas possibilidades
                <br />
                com mais tranquilidade.
              </h2>
            </div>
            <Link className="btn white" href="/pre-analise">
              Solicitar pré-análise <ArrowRight size={18} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
      <TrackedLink
        className="whatsapp"
        aria-label="Falar pelo WhatsApp"
        event="whatsapp_click"
        href={whatsappUrl(
          "Olá, vim pelo site da Central Precatórios e gostaria de solicitar uma análise.",
        )}
      >
        <MessageCircle />
      </TrackedLink>
    </>
  );
}
export function Header() {
  return (
    <><header>
      <div className="shell nav">
        <Link href="/" className="brand">
          <span className="brand-mark"><Image src="/brand/central-mark.png" alt="" width={44} height={44} priority /></span>
          <b>
            central<small>PRECATÓRIOS</small>
          </b>
        </Link>
        <nav>
          <Link href="/#como">Como funciona</Link>
          <Link href="/consultar-precatorio">Consultar precatório</Link>
          <Link href="/documentos">Documentos</Link>
          <Link href="/#duvidas">Dúvidas</Link>
          <Link href="/plataforma">Para profissionais</Link>
        </nav>
        <details className="mobile-menu">
          <summary>Menu</summary>
          <div>
            <Link href="/#como">Como funciona</Link>
            <Link href="/consultar-precatorio">Consultar precatório</Link>
            <Link href="/documentos">Documentos</Link>
            <Link href="/#duvidas">Dúvidas</Link>
            <Link href="/plataforma">Para empresas e especialistas</Link>
          </div>
        </details>
        <Link href="/pre-analise" className="nav-cta">
          <span className="desktop-label">Fazer pré-análise</span>
          <span className="mobile-label">Analisar</span>
          <ArrowRight size={16} />
        </Link>
      </div>
    </header><RouteHero /></>
  );
}
export function Footer() {
  return (
    <footer>
      <div className="shell footer-grid">
        <div>
          <div className="brand inverse">
            <span className="brand-mark"><Image src="/brand/central-mark.png" alt="" width={44} height={44} /></span>
            <b>
              central<small>PRECATÓRIOS</small>
            </b>
          </div>
          <p>Informação clara para decisões importantes.</p>
        </div>
        <div>
          <b>Explore</b>
          <Link href="/assistente">Assistente</Link>
          <Link href="/simulador">Simulador</Link>
          <Link href="/documentos">Documentos</Link>
        </div>
        <div>
          <b>Institucional</b>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/termos">Termos de uso</Link>
          <Link href="/parceiros">Seja um parceiro</Link>
          <Link href="/plataforma">Plataforma CP</Link>
          <Link href="/precos">Planos e preços</Link>
          <Link href="/conta">Acessar plataforma</Link>
          <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer">
            Instagram {CONTACT.instagramHandle}
          </a>
        </div>
        <div>
          <b>Importante</b>
          <p>
            O conteúdo é informativo e não constitui aconselhamento jurídico ou
            proposta comercial.
          </p>
          <p>Atendimento inicial: {CONTACT.initialAnalyst}</p>
          <a href={`mailto:${CONTACT.businessEmail}`}>
            {CONTACT.businessEmail}
          </a>
        </div>
      </div>
      <div className="shell footnote">
        © 2026 Central Precatórios. Plataforma independente de qualificação e
        encaminhamento.
      </div>
    </footer>
  );
}
