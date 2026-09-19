import { chromium } from "playwright";

const targets=[
 "FAZENDA DO ESTADO DE SÃO PAULO",
 "MUNICÍPIO DE SÃO PAULO",
 "MUNICÍPIO DE CAMPINAS",
 "CAMPREV - INSTITUTO DE PREVIDÊNCIA SOCIAL DO MUNICÍPIO DE CAMPINAS",
 "USP - UNIVERSIDADE DE SÃO PAULO",
];
const base="https://esaj.tjsp.jus.br/portalDevedor/abrirConsultaListaPagamentos.do";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage();
const requestLog:{path:string;method:string;kind:string;status?:number;contentType?:string}[]=[];
const onRequest=(request:import("playwright").Request)=>{if(request.url().startsWith("https://esaj.tjsp.jus.br/portalDevedor/")&&["document","xhr","fetch"].includes(request.resourceType()))requestLog.push({path:new URL(request.url()).pathname.replace(/;jsessionid=[^/]+/,";jsessionid=[redacted]"),method:request.method(),kind:request.resourceType()})};
const onResponse=(response:import("playwright").Response)=>{const entry=requestLog.find(x=>x.path===new URL(response.url()).pathname.replace(/;jsessionid=[^/]+/,";jsessionid=[redacted]")&&!x.status);if(entry){entry.status=response.status();entry.contentType=response.headers()["content-type"]||""}};
page.on("request",onRequest);page.on("response",onResponse);
try{
 const robots=await page.request.get("https://esaj.tjsp.jus.br/robots.txt",{timeout:10_000}).catch(()=>null);
 console.log(JSON.stringify({robots:robots?.status()===200?"VERIFIED":robots?.status()===404?"UNVERIFIED_404":"UNVERIFIED_OTHER"}));
 for(const requestedName of targets){
  await page.goto(base,{waitUntil:"domcontentloaded",timeout:25_000});
  const entity=await page.locator('select[name="dadosParaConsulta.pagamento.entidadeDevedora.cdPessoa"] option').evaluateAll((items,name)=>{const o=items.find(option=>option.textContent?.trim().toLocaleUpperCase("pt-BR")===name.toLocaleUpperCase("pt-BR"));return o?{id:(o as HTMLOptionElement).value,name:o.textContent?.trim()||name}:null},requestedName);
  if(!entity){console.log(JSON.stringify({entity:requestedName,state:"ENTITY_NOT_IN_PUBLIC_SELECT"}));continue}
  const requestStart=requestLog.length;
  await page.selectOption('select[name="dadosParaConsulta.pagamento.entidadeDevedora.cdPessoa"]',entity.id);
  await page.locator('input[type="submit"][value="Pesquisar"]').click();
  await page.waitForLoadState("domcontentloaded",{timeout:20_000}).catch(()=>{});
  await page.waitForTimeout(300);
  const result=await page.evaluate(()=>{
   const text=document.body.innerText;
   const pending=text.includes("Não há lista de precatórios pendentes de pagamento para esta entidade")?"NO_CURRENT_PENDING_LIST":text.includes("Resultado da pesquisa")?"PENDING_SECTION_RETURNED":"PENDING_STATE_UNCLEAR";
   const payment=text.match(/Não foram disponibilizados pagamentos de precatórios[^\n]*/i)?.[0]||"PAYMENT_STATE_UNCLEAR";
   const tableRows=[...document.querySelectorAll("table")].map(table=>table.rows.length);
   const pagination=[...document.querySelectorAll("a[href]")].map(a=>(a as HTMLAnchorElement).innerText.trim()).filter(x=>/próxima|anterior|página|page/i.test(x));
   return{pending,payment,paymentState:payment.startsWith("Não foram")?"NO_PAYMENT_IN_DISPLAYED_YEAR":"PAYMENT_OR_YEAR_FILTER_PRESENT",displayedYear:payment.match(/20\d{2}/)?.[0]||"",tableRows,pagination};
  });
  const observed=requestLog.slice(requestStart).map(({path,method,kind,status,contentType})=>({path,method,kind,status,contentType}));
  console.log(JSON.stringify({entity,queryPath:"GET /portalDevedor/consultarListaPagamentos.do?dadosParaConsulta.pagamento.entidadeDevedora.cdPessoa={public-id}",result,observed}));
  await new Promise(resolve=>setTimeout(resolve,900));
 }
}finally{await browser.close()}
