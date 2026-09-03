import DealEconomics from "@/components/DealEconomics";
import { Footer, Header } from "../page";

export const metadata = { title: "Economia da operação", description: "Workspace educativo para estruturar cenários econômicos de operações com precatórios." };

export default function Page() {
  return <><Header /><main className="professional-tool"><div className="shell narrow">
    <span className="kicker">CP DEAL ECONOMICS · BETA</span>
    <h1>Estruture a economia da operação <em>antes de decidir.</em></h1>
    <p>Uma visão padronizada de preço, custos, prazo e recebimento líquido para empresas e especialistas compararem cenários com mais consistência.</p>
    <DealEconomics />
  </div></main><Footer /></>;
}
