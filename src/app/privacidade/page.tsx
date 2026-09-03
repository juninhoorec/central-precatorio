import { Header, Footer } from "../page";
import { CONTACT } from "@/lib/contact";
export default function Page() {
  return (
    <>
      <Header />
      <main className="listing">
        <div className="shell">
          <span className="kicker">PRIVACIDADE</span>
          <h1>
            Seus dados,
            <br />
            <em>tratados com respeito.</em>
          </h1>
          <p>
            Coletamos nome, WhatsApp, e-mail opcional e as respostas fornecidas
            para registrar a solicitação, qualificar a oportunidade e permitir o
            contato da analista responsável. O progresso temporário fica no
            navegador; após o envio, os dados são registrados no servidor.
          </p>
          <div className="privacy-sections">
            <section><h2>Finalidades</h2><p>Para titulares: responder, organizar a pré-análise, prevenir abuso e acompanhar a origem da campanha. Para empresas e especialistas: avaliar o perfil, responder ao interesse de parceria e manter o histórico da conversa comercial.</p></section>
            <section><h2>Compartilhamento</h2><p>Nenhum caso é encaminhado a empresa ou especialista parceiro sem uma base legal adequada e a transparência necessária sobre esse encaminhamento. Não vendemos listas de contatos.</p></section>
            <section><h2>Seus direitos</h2><p>Você pode pedir confirmação, acesso, correção ou exclusão dos dados, além de informações sobre uso e compartilhamento, pelo canal abaixo.</p></section>
            <section><h2>Segurança e retenção</h2><p>Aplicamos coleta mínima, controle de acesso e registro operacional. Solicitações e interesses comerciais ficam guardados por até 24 meses após o último contato, salvo pedido de exclusão ou conservação necessária para cumprir obrigação legal ou defender direitos.</p></section>
          </div>
          <div className="privacy-contact">
            <strong>Atendimento inicial</strong>
            <p>{CONTACT.initialAnalyst}</p>
            <strong>Canal para dúvidas e direitos sobre dados</strong>
            <p>
              <a href={`mailto:${CONTACT.businessEmail}`}>
                {CONTACT.businessEmail}
              </a>{" "}
              · {CONTACT.whatsappDisplay}
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
