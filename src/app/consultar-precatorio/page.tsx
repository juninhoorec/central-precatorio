import { Header, Footer } from "../page";
import Link from "next/link";
import { ArrowUpRight, Landmark } from "lucide-react";

const officialSources = [
  ["TJSP · Credores", "Listas, pagamentos, mapas, valores atualizados e formulários.", "https://www.tjsp.jus.br/Precatorios/Precatorios/Credores"],
  ["TJSP · Pesquisa", "Pesquisa oficial de precatórios e pagamentos.", "https://www.tjsp.jus.br/cac/scp/webmenupesquisa.aspx"],
  ["TRF3 · RPV e precatórios", "Orientação e acesso à consulta de requisições federais.", "https://www.trf3.jus.br/carta-servicos/rpv-e-precatorios/"],
  ["CNJ · Resolução 303", "Norma nacional de gestão e procedimentos operacionais.", "https://atos.cnj.jus.br/atos/detalhar/3130"],
] as const;
export default function Page() {
  return (
    <>
      <Header />
      <main className="listing">
        <div className="shell">
          <span className="kicker">GUIA DE CONSULTA</span>
          <h1>
            Consulte seu precatório
            <br />
            <em>em fontes oficiais.</em>
          </h1>
          <p>
            Identifique primeiro o tribunal responsável pelo processo. Use
            apenas o portal oficial desse tribunal e localize a área de consulta
            processual ou precatórios. Tenha o número do processo em mãos quando
            possível.
          </p>
          <div className="official-grid">
            {officialSources.map(([title, description, href]) => <a key={title} href={href} target="_blank" rel="noopener noreferrer"><Landmark/><div><h2>{title}</h2><p>{description}</p></div><ArrowUpRight/></a>)}
          </div>
          <div className="clarity">
            <h2>Esta plataforma não é um tribunal.</h2>
            <p>
              Não exibimos dados oficiais do processo nem substituímos
              orientação jurídica. Em caso de dúvida, procure o profissional
              responsável pelo seu processo. Alguns portais pedem CPF/CNPJ,
              OAB, número do processo, ofício requisitório ou protocolo; confira
              sempre o domínio oficial antes de informar qualquer dado.
            </p>
          </div>
          <Link className="btn primary" href="/assistente">
            Usar o assistente
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
