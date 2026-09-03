import Wizard from "@/components/Wizard";
import PageHero from "@/components/PageHero";
export default function Page() {
  return <><PageHero label="ASSISTENTE CP" title="Encontre seu próximo passo." kind="atendimento" compact/><Wizard mode="assistant" /></>;
}
