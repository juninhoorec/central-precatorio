import type { Metadata } from "next";
import NegotiationTool from "./NegotiationTool";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Ferramentas de negociação",
  description:
    "Calcule cenários de preço, compare ofertas e organize a solicitação documental de uma negociação de precatório.",
};

export default function Page() {
  return <><PageHero label="NEGOCIAÇÃO" title="Mais clareza para comparar oportunidades." kind="documentos" compact/><NegotiationTool /></>;
}
