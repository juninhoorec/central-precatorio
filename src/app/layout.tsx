import type { Metadata } from "next";
import { Cormorant_Garamond, Manrope } from "next/font/google";
import "./globals.css";
import "./visual-upgrade.css";
import ScrollProgress from "@/components/ScrollProgress";
import AttributionTracker from "@/components/AttributionTracker";
import { Suspense } from "react";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  weight: ["500", "600", "700"],
});
export const metadata: Metadata = {
  title: {
    default: "Central Precatórios | Pré-análise independente",
    template: "%s | Central Precatórios",
  },
  description:
    "Plataforma independente para organizar informações e solicitar uma pré-análise de precatórios.",
  metadataBase: new URL("https://centralprecatorios.com.br"),
  openGraph: {
    title: "Central Precatórios",
    description:
      "Informação clara e encaminhamento responsável para decisões importantes.",
    type: "website",
    locale: "pt_BR",
    images: ["/brand/central-logo-original.png"],
  },
  icons: { icon: "/icon.png", apple: "/icon.png" },
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${manrope.variable} ${cormorant.variable}`}>
      <body>
        <Suspense fallback={null}>
          <AttributionTracker />
        </Suspense>
        {children}
        <Suspense fallback={null}><ScrollProgress /></Suspense>
      </body>
    </html>
  );
}
