import type { MetadataRoute } from "next";
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    "",
    "/ferramentas",
    "/ferramentas/negociacao",
    "/assistente",
    "/pre-analise",
    "/simulador",
    "/consultar-precatorio",
    "/documentos",
    "/parceiros",
    "/plataforma",
    "/economia-operacao",
    "/precos",
    "/privacidade",
    "/termos",
  ].map((p) => ({
    url: "https://centralprecatorios.com.br" + p,
    lastModified: new Date(),
  }));
}
