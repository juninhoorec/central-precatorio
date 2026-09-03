import Link from "next/link";
import { ArrowRight, BadgeCheck, BarChart3, Target, Users } from "lucide-react";
import { Footer, Header } from "../page";
import { CONTACT, whatsappUrl } from "@/lib/contact";
import PartnerForm from "@/components/PartnerForm";
export const metadata = {
  title: "Parcerias",
  description:
    "Conheça o modelo de parceria da Central Precatórios para oportunidades qualificadas.",
};
export default function Page() {
  return (
    <>
      <Header />
      <main className="partner-page">
        <section className="partner-hero shell">
          <span className="kicker">ECOSSISTEMA DE PARCEIROS</span>
          <h1>
            Boas oportunidades precisam encontrar <em>o parceiro certo.</em>
          </h1>
          <p>
            A Central organiza interesse, origem e dados iniciais para facilitar
            conversas mais objetivas entre titulares e profissionais do mercado
            de precatórios.
          </p>
          <a
            className="btn primary"
            href={whatsappUrl(
              "Olá, represento uma empresa do mercado de precatórios e gostaria de conversar sobre parceria com a Central.",
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Quero ser parceiro <ArrowRight />
          </a>
          <p className="partner-email">
            Contato comercial:{" "}
            <a href={`mailto:${CONTACT.businessEmail}`}>
              {CONTACT.businessEmail}
            </a>
          </p>
          <p className="partner-email">
            Acompanhe: <a href={CONTACT.instagramUrl} target="_blank" rel="noopener noreferrer">{CONTACT.instagramHandle}</a>
          </p>
        </section>
        <section className="partner-benefits shell">
          <article>
            <Target />
            <h2>Oportunidades qualificadas</h2>
            <p>
              Contexto, intenção e informações iniciais organizadas antes do
              contato.
            </p>
          </article>
          <article>
            <BarChart3 />
            <h2>Origem rastreável</h2>
            <p>Visibilidade de canal, campanha, página e evolução comercial.</p>
          </article>
          <article>
            <Users />
            <h2>Modelo escalável</h2>
            <p>
              Estrutura preparada para separar parceiros, responsáveis e
              resultados.
            </p>
          </article>
        </section>
        <section className="partner-proof">
          <div className="shell">
            <BadgeCheck />
            <div>
              <span className="kicker">TRANSPARÊNCIA PRIMEIRO</span>
              <h2>Sem logos decorativos ou parcerias inventadas.</h2>
              <p>
                Parceiros serão publicados somente após validação e autorização.
                Isso protege a reputação de todos e fortalece a confiança de
                quem procura atendimento.
              </p>
            </div>
            <Link href="/pre-analise">
              Conhecer o fluxo <ArrowRight />
            </Link>
          </div>
        </section>
        <section className="platform-preview shell">
          <div><span className="kicker">TECNOLOGIA PARA O ECOSSISTEMA</span><h2>Uma operação completa está sendo construída ao redor da oportunidade.</h2><p>Pipeline, cenários econômicos, sala de documentos, matching transparente e inteligência de marketing fazem parte da visão CP.</p></div>
          <Link className="btn ghost" href="/plataforma">Conhecer a plataforma <ArrowRight /></Link>
        </section>
        <section className="partner-form-section shell">
          <div>
            <span className="kicker">CONVERSA COMERCIAL</span>
            <h2>Parcerias começam com alinhamento.</h2>
            <p>
              Conte brevemente quem você representa. O cadastro entra em um
              pipeline separado das oportunidades de titulares.
            </p>
          </div>
          <PartnerForm />
        </section>
      </main>
      <Footer />
    </>
  );
}
