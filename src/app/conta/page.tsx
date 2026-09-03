import AccountClient from "./account-client";
import PageHero from "@/components/PageHero";
export const metadata = { title: "Minha conta | Central Precatórios", robots: { index: false, follow: false } };
export default function AccountPage() { return <><PageHero label="CONTA CP" title="Seu acesso. Sua empresa. Seus dados." kind="parceiros" compact/><AccountClient /></>; }
