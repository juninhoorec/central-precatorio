import type { Metadata } from "next";
import PageHero from "@/components/PageHero";
export const metadata: Metadata = {
  title: "Painel operacional",
  robots: { index: false, follow: false },
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <><PageHero label="ADMINISTRAÇÃO CP" title="Cada contato merece atenção." kind="parceiros" compact/>{children}</>;
}
