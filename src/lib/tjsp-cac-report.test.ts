import {describe,expect,it} from "vitest";
import {cacRecordsToCsv,parseTjspCacPage,type CacTextItem} from "./tjsp-cac-report";
import {parseTjspCsv} from "./tjsp-import";

const card=(overrides:Partial<Record<string,string|number>>={}):CacTextItem[]=>[
 {text:"7654321-12.2020.8.26.0001",x:75,y:758},{text:"ALIMENTARES",x:75,y:746},
 {text:"Ordem",x:75,y:734},{text:"1",x:108,y:734},
 {text:"Nº Processo DEPRE:",x:343,y:734},{text:"1234567-12.2024.8.26.0001",x:448,y:734},
 {text:"Natureza:",x:75,y:722},{text:"ALIMENTAR",x:196,y:722},
  {text:"ES/EP:",x:75,y:715},{text:"5910/2014",x:196,y:715},
 {text:"autos:",x:108,y:710},{text:"8765432-34.2019.8.26.0002",x:196,y:710},
 {text:"Ordem Orçamentária:",x:339,y:710},{text:"2025",x:448,y:710},
 {text:"Valor atualizado:",x:349,y:698},{text:"250.000,00",x:554,y:698},
 {text:"Data do Protocolo:",x:75,y:685},{text:"01/09/2026",x:196,y:685},
 {text:"Nº do Protocolo Geral:",x:315,y:685},{text:"12345",x:448,y:685},
 {text:"Devedora:",x:75,y:647},{text:"MUNICIPIO TESTE",x:147,y:647},
 ...Object.entries(overrides).map(([text,value])=>({text,x:600,y:Number(value)})),
];

describe("TJSP CAC pending PDF parser",()=>{
 it("extracts only labeled identifiers and amounts, preserving source location without inferring creditor",()=>{
  const rows=parseTjspCacPage(card(),1,"ListaPrecatorioPendente_731257.pdf");
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({paymentOrder:"1",numeroProcessoDEPRE:"1234567-12.2024.8.26.0001",numeroAutos:"8765432-34.2019.8.26.0002",epesNumber:"5910",epesYear:"2014",originProcessNumber:"7654321-12.2020.8.26.0001",amount:250000,debtor:"MUNICIPIO TESTE",nature:"ALIMENTAR",valueDate:"",protocolDate:"01/09/2026",protocol:"",generalProtocol:"12345",page:1,record:1,archiveEntry:"ListaPrecatorioPendente_731257.pdf",creditNumber:"",creditor:""});
 });

 it("rejects a candidate without record or report-header debtor evidence",()=>{
  const rows=parseTjspCacPage(card().filter(item=>item.text!=="Devedora:"&&item.text!=="MUNICIPIO TESTE"),2);
  expect(rows).toEqual([]);
 });

 it("exports real observations in the existing CSV ingestion schema with row/page provenance",()=>{
    const record=parseTjspCacPage(card(),3,"ListaPrecatorioPendente_731257.pdf")[0],csv=cacRecordsToCsv([record],{sourceFileName:"relatorio.zip",sourceFileChecksum:"hash-sha256",captureSessionId:"session-id"});
  expect(csv).toContain("Nº Processo DEPRE");
  expect(csv).toContain("1234567-12.2024.8.26.0001");
  expect(csv).toContain("250000");
  expect(csv).toContain("Página da fonte");
  expect(csv).toContain(";3;1;");
    const normalized=parseTjspCsv(csv).rows[0];
    expect(normalized).toMatchObject({processNumber:"",numeroProcessoDEPRE:"1234567-12.2024.8.26.0001",numeroAutos:"8765432-34.2019.8.26.0002",epesNumber:"5910",epesYear:"2014",originProcessNumber:"7654321-12.2020.8.26.0001",protocolDate:"01/09/2026",amount:250000,sourcePage:3,sourceRecord:1});
 });
});