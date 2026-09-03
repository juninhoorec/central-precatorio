import Wizard from "@/components/Wizard";
import PageHero from "@/components/PageHero";
export default function Page() {
  return <><PageHero label="PRÉ-ANÁLISE" title="O primeiro passo é uma boa conversa." kind="atendimento" compact/><Wizard mode="pre" /></>;
}
