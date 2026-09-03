import { Header, Footer } from "../page";
import { CheckCircle2 } from "lucide-react";
export default function Page() {
  const x = [
    "Número do processo ou do precatório",
    "Nome da entidade devedora",
    "Valor aproximado, se conhecido",
    "Tribunal ou origem do processo",
    "Situação atual, se conhecida",
  ];
  return (
    <>
      <Header />
      <main className="listing">
        <div className="shell">
          <span className="kicker">CHECKLIST GRATUITO</span>
          <h1>
            O que ajuda em uma
            <br />
            <em>primeira análise?</em>
          </h1>
          <p>
            Você não precisa ter tudo agora. Comece com as informações
            disponíveis.
          </p>
          <div className="listing-grid">
            {x.map((i) => (
              <div key={i} className="tool-card">
                <CheckCircle2 />
                <div>
                  <h3>{i}</h3>
                  <p>Tenha esta informação em mãos, se estiver disponível.</p>
                </div>
              </div>
            ))}
          </div>
          <p>
            <strong>Importante:</strong> não envie documentos sensíveis pela
            área pública.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
