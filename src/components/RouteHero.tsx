"use client";
import { usePathname } from "next/navigation";
import PageHero from "./PageHero";
const pages:Record<string,[string,string,"atendimento"|"parceiros"|"documentos"]>={
  "/ferramentas":["RECURSOS CP","Conhecimento que ajuda a decidir.","documentos"],
  "/consultar-precatorio":["CONSULTA E ORIENTAÇÃO","O seu caminho começa na informação.","documentos"],
  "/documentos":["PREPARAÇÃO DOCUMENTAL","Cada detalhe bem organizado.","documentos"],
  "/parceiros":["REDE DE PARCEIROS","Boas relações. Novas possibilidades.","parceiros"],
  "/plataforma":["PLATAFORMA CP","Sua operação, em uma nova perspectiva.","parceiros"],
  "/precos":["PLANOS PARA PROFISSIONAIS","Uma estrutura para crescer com você.","parceiros"],
  "/privacidade":["PRIVACIDADE","Confiança começa com transparência.","documentos"],
  "/termos":["TERMOS DE USO","Uma relação com regras claras.","documentos"],
  "/economia-operacao":["INTELIGÊNCIA DE NEGOCIAÇÃO","Premissas claras. Decisões melhores.","documentos"],
};
export default function RouteHero(){const path=usePathname();const item=pages[path];return item?<PageHero label={item[0]} title={item[1]} kind={item[2]}/>:null;}
