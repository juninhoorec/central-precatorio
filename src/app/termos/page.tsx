import { Header, Footer } from "../page";
export default function Page() {
  return (
    <>
      <Header />
      <main className="listing">
        <div className="shell">
          <span className="kicker">TERMOS DE USO</span>
          <h1>
            Informação clara,
            <br />
            <em>sem promessas indevidas.</em>
          </h1>
          <p>
            As ferramentas têm caráter informativo. Nenhum resultado constitui
            proposta, garantia de compra, prazo, valor definitivo ou
            aconselhamento jurídico. Uma eventual operação depende de análise
            documental e comercial.
          </p>
          <p>
            O cadastro de empresas e especialistas representa apenas interesse em parceria. Não cria credenciamento, exclusividade, indicação, vínculo societário ou obrigação de encaminhamento.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
