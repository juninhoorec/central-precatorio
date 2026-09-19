"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Plus, Scale, ShieldCheck } from "lucide-react";
import { allowedTransitions, calculatePricing, nextActionFor, summarizeEvidence, transitionBlockReason, type OperationalWorkflow } from "@/lib/operational-workflow";
import styles from "./operations.module.css";
import IntelligencePanel from "./intelligence-panel";

type Props = { workflow: OperationalWorkflow; persistedStage: OperationalWorkflow["stage"]; mode: string; debtor: string; nominal: number; isDemo: boolean; onChange: (workflow: OperationalWorkflow) => void; onContinue: (tab: string) => void };
const money = (n:number) => n.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
const labels:Record<string,string>={NEW:"Novo",TRIAGE:"Triagem",QUERY:"Consulta",VALIDATION:"Validação",DOCUMENTS:"Documentos",LEGAL_REVIEW:"Revisão jurídica",APPROVED:"Aprovado",PROPOSAL:"Proposta",NEGOTIATION:"Negociação",ACCEPTED:"Aceito",CESSION:"Cessão",POST_CESSION:"Pós-cessão",COMPLETED:"Concluído",REJECTED:"Reprovado",LOST:"Perdido",BLOCKED:"Bloqueado",CANCELLED:"Cancelado"};
const reviewLabels:Record<string,string>={PENDING:"Pendente",APPROVED:"Aprovado",APPROVED_WITH_REMARKS:"Aprovado com ressalva",NEEDS_DOCUMENTS:"Documentos necessários",REJECTED:"Reprovado"};
function CreditIdentifiers({workflow}:{workflow:OperationalWorkflow}){const credit=workflow.credit;return <div className={styles.sourceNote}><b>Nº Processo DEPRE</b><span>{credit.numeroProcessoDEPRE||"Não identificado na fonte consultada."}</span><small>Valor normalizado: {credit.numeroProcessoDEPRENormalizado||"—"}</small><span>EP/ES: {credit.epesNumber?`${credit.epesNumber}${credit.epesYear?`/${credit.epesYear}`:""}`:"Não identificado na fonte consultada."}</span><span>Processo originário: {credit.originProcessNumber||"Não identificado na fonte consultada."}</span></div>}

export default function OperationalCase({workflow:w, persistedStage, mode, debtor, nominal, isDemo, onChange, onContinue}:Props) {
  const set = (patch:Partial<OperationalWorkflow>) => onChange({...w,...patch});
  const now = () => new Date().toISOString();
  const [showEvidence, setShowEvidence] = useState(false);
  const evidenceRows = summarizeEvidence(w.evidence);
  if (mode === "Visão geral") return <div className={styles.form}>
    <div className={styles.caseSummary}>
      <article><small>PRÓXIMA AÇÃO</small><strong>{nextActionFor(w)}</strong><span>{w.nextAction.dueAt || "Defina um prazo"}</span></article>
      <article><small>CONFIANÇA DO ANALISTA</small><strong>{w.confidence}%</strong><span>Classificação manual, apoiada pelas evidências</span></article>
      <article><small>JURÍDICO</small><strong>{w.legalStatus}</strong><span>{w.legalReviews.length} revisão(ões)</span></article>
      <article><small>DOCUMENTOS</small><strong>{w.documentStatus}</strong><span>Status de conferência</span></article>
    </div>
    <CreditIdentifiers workflow={w}/>
    <h3>{isDemo ? "Lead captado · dados sintéticos" : "Dados do crédito"}</h3>
    <div className={styles.caseSummary}>
      <article><small>VALOR ATUALIZADO</small><strong>{money(nominal)}</strong><span>Data de referência: {w.credit.valueDate || "Não informada"}</span></article>
      <article><small>DEVEDORA</small><strong>{debtor || "A confirmar"}</strong><span>{w.credit.debtorState}</span></article>
      <article><small>NATUREZA</small><strong>{w.credit.nature || "A confirmar"}</strong><span>{w.credit.creditType === "RPV" ? "RPV" : "Precatório"}</span></article>
      <article><small>FONTE</small><strong>{w.credit.sourceName || "Não informada"}</strong><span>Coletado: {w.credit.checkedAt ? new Date(w.credit.checkedAt).toLocaleString("pt-BR") : "Não informado"}</span></article>
    </div>
    {isDemo && <div className={styles.demoBanner}>DADOS DE DEMONSTRAÇÃO — SEM VALIDADE REAL</div>}
    <h3>Identidade do Credor</h3>
    {isDemo && <div className={styles.demoBanner}>SIMULAÇÃO — DADOS SINTÉTICOS · SEM CONSULTA A FONTE EXTERNA</div>}
    <div className={styles.caseSummary}>
      <article><small>ESTADO</small><strong>{w.creditorResolution.state.replace(/_/g, " ")}</strong><span>Confiança: {w.creditorResolution.confidence}</span></article>
      <article><small>TITULAR ATUAL</small><strong>{w.creditorResolution.currentHolderStatus.replace(/_/g, " ")}</strong><span>{w.creditorResolution.explanation}</span></article>
    </div>
    <div className={styles.fields}>
      <label>Nome Resolvido<input value={w.creditorResolution.identifiedName} readOnly/></label>
      <label>Próxima Ação de Identidade<input value={w.creditorResolution.nextAction} readOnly/></label>
      <label>Última Validação<input value={w.creditorResolution.updatedAt ? new Date(w.creditorResolution.updatedAt).toLocaleDateString("pt-BR") : "Nunca"} readOnly/></label>
    </div>
    <button onClick={() => setShowEvidence((current) => !current)}>{showEvidence ? "Ocultar evidências" : "Ver evidências"}</button>
    {showEvidence && (
      evidenceRows.length === 0 ? (
        <div className={styles.notice}><ShieldCheck/><div><b>Evidência ainda não registrada</b><p>Não há origem cadastrada para este caso. Registre uma fonte oficial ou documento antes de avançar.</p></div></div>
      ) : (
        <div className={styles.fields}>
          {w.evidence.map((e, index) => (
            <div key={e.id} className={styles.sourceNote}>
              <b>{e.source}</b>
              <span>{e.sourceType}</span>
              <small>{e.reference || "Sem referência"}</small>
              <small>Data de coleta: {new Date(e.retrievedAt).toLocaleString("pt-BR")}</small>
              <span>Confiança: {e.confidence}%</span>
              <span>Status: {e.status}</span>
              {e.notes ? <small>{e.notes}</small> : null}
              <small>{evidenceRows[index]?.summary}</small>
            </div>
          ))}
        </div>
      )
    )}
    {isDemo && <button onClick={()=>onContinue("Consulta e validação")}>Validar lead</button>}
    <h3>Identificação do caso</h3>
    <div className={styles.fields}>
      <label>Credor<input value={w.client.name} onChange={e=>set({client:{...w.client,name:e.target.value}})}/></label>
      <label>CPF/CNPJ<input value={w.client.document} onChange={e=>set({client:{...w.client,document:e.target.value}})}/></label>
      <label>Telefone<input value={w.client.phone} onChange={e=>set({client:{...w.client,phone:e.target.value}})}/></label>
      <label>E-mail<input type="email" value={w.client.email} onChange={e=>set({client:{...w.client,email:e.target.value}})}/></label>
      <label>Número do precatório<input value={w.credit.precatoryNumber} onChange={e=>set({credit:{...w.credit,precatoryNumber:e.target.value}})}/></label>
      <label>Natureza<input value={w.credit.nature} onChange={e=>set({credit:{...w.credit,nature:e.target.value}})}/></label>
      <label>Prioridade<select value={w.priority} onChange={e=>set({priority:e.target.value as OperationalWorkflow["priority"]})}>{["LOW","MEDIUM","HIGH","URGENT"].map(v=><option key={v}>{v}</option>)}</select></label>
      <label>Confiança atribuída pelo analista (%)<input type="number" min="0" max="100" value={w.confidence} onChange={e=>set({confidence:Number(e.target.value)})}/></label>
      <label>Status documental<select value={w.documentStatus} onChange={e=>set({documentStatus:e.target.value as OperationalWorkflow["documentStatus"]})}>{[["MISSING","Ausente"],["INCOMPLETE","Incompleto"],["READY","Conferido"],["REVIEW_REQUIRED","Revisão necessária"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    </div>
    <h3>Fluxo controlado</h3><div className={styles.workflowSteps}><b>{labels[w.stage]||w.stage}</b>{w.stage!==persistedStage?<span>Salve esta etapa antes de avançar novamente.</span>:allowedTransitions[w.stage].map(stage=>{const reason=transitionBlockReason(w,stage);return <button title={reason||undefined} disabled={Boolean(reason)} key={stage} onClick={()=>set({stage})}>Avançar para {labels[stage]||stage}</button>})}</div>
    <h3>Próxima ação</h3><div className={styles.fields}><label>Ação<input value={w.nextAction.title} onChange={e=>set({nextAction:{...w.nextAction,title:e.target.value}})}/></label><label>Prazo<input type="date" value={w.nextAction.dueAt.slice(0,10)} onChange={e=>set({nextAction:{...w.nextAction,dueAt:e.target.value}})}/></label><label>Estado<select value={w.nextAction.status} onChange={e=>set({nextAction:{...w.nextAction,status:e.target.value as OperationalWorkflow["nextAction"]["status"]}})}>{["PENDING","DONE","BLOCKED"].map(v=><option key={v}>{v}</option>)}</select></label></div>
  </div>;

  if (mode === "Consulta e validação") return <div className={styles.form}>
    <CreditIdentifiers workflow={w}/>
    <div className={styles.notice}><ShieldCheck/><div><b>Evidência, não adivinhação</b><p>Registre a fonte, a referência e o grau de confiança. Uma fonte isolada não representa cobertura nacional.</p></div></div>
    <label>Status da consulta<select value={w.queryStatus} onChange={e=>set({queryStatus:e.target.value as OperationalWorkflow["queryStatus"]})}>{[["NOT_STARTED","Não iniciada"],["RUNNING","Em andamento"],["CONFIRMED","Confirmada por evidência"],["PARTIAL","Compatível / parcial"],["UNAVAILABLE","Fonte indisponível"],["MANUAL_REQUIRED","Consulta assistida necessária"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
    <button onClick={()=>set({evidence:[...w.evidence,{id:crypto.randomUUID(),source:"Fonte oficial a confirmar",sourceType:"OFFICIAL",reference:"",retrievedAt:now(),confidence:0,status:"REVISÃO HUMANA NECESSÁRIA",notes:""}]})}><Plus size={16}/> Registrar evidência</button>
    {w.evidence.map((e,i)=><article className={styles.proposal} key={e.id}><div className={styles.fields}><label>Fonte<input value={e.source} onChange={x=>set({evidence:w.evidence.map((v,j)=>j===i?{...v,source:x.target.value}:v)})}/></label><label>Referência/URL<input value={e.reference} onChange={x=>set({evidence:w.evidence.map((v,j)=>j===i?{...v,reference:x.target.value}:v)})}/></label><label>Confiança<input type="number" min="0" max="100" value={e.confidence} onChange={x=>set({evidence:w.evidence.map((v,j)=>j===i?{...v,confidence:Number(x.target.value)}:v)})}/></label><label>Status<select value={e.status} onChange={x=>set({evidence:w.evidence.map((v,j)=>j===i?{...v,status:x.target.value as typeof e.status}:v)})}>{["CONFIRMADO","COMPATÍVEL","INCOMPLETO","NÃO ENCONTRADO","FONTE INDISPONÍVEL","REVISÃO HUMANA NECESSÁRIA"].map(v=><option key={v}>{v}</option>)}</select></label></div></article>)}
    <button onClick={()=>set({validations:[...w.validations,{id:crypto.randomUUID(),check:"Nova verificação",severity:"INFO",status:"PENDING",explanation:""}]})}><Plus size={16}/> Adicionar verificação</button>
    {w.validations.map((v,i)=><article className={styles.validation} key={v.id}><AlertTriangle size={17}/><input aria-label="Verificação" value={v.check} onChange={e=>set({validations:w.validations.map((x,j)=>j===i?{...x,check:e.target.value}:x)})}/><select aria-label="Severidade" value={v.severity} onChange={e=>set({validations:w.validations.map((x,j)=>j===i?{...x,severity:e.target.value as typeof v.severity}:x)})}>{["INFO","WARNING","CRITICAL"].map(x=><option key={x}>{x}</option>)}</select><select aria-label="Resultado" value={v.status} onChange={e=>set({validations:w.validations.map((x,j)=>j===i?{...x,status:e.target.value as typeof v.status}:x)})}>{["PENDING","PASSED","FAILED","HUMAN_REVIEW"].map(x=><option key={x}>{x}</option>)}</select></article>)}
  </div>;

  if (mode === "Jurídico") return <div className={styles.form}>
    <div className={styles.notice}><Scale/><div><b>Decisão humana obrigatória</b><p>O CP organiza o dossiê e as pendências; não substitui a revisão de profissional habilitado.</p></div></div>
    {isDemo && <div className={styles.demoBanner}>SIMULAÇÃO — DADOS SINTÉTICOS · SEM APROVAÇÃO JURÍDICA REAL</div>}
    <button onClick={()=>set({legalStatus:"PENDING",legalReviews:[...w.legalReviews,{id:crypto.randomUUID(),status:"PENDING",reviewer:"",requestedAt:now(),reviewedAt:"",observations:"",dossierVersion:w.legalReviews.length+1}]})}><Plus size={16}/> Enviar para jurídico</button>
    {w.legalReviews.map((r,i)=><article className={styles.proposal} key={r.id}>
      <div className={styles.fields}>
        <label>Revisor<input value={r.reviewer} onChange={e=>set({legalReviews:w.legalReviews.map((x,j)=>j===i?{...x,reviewer:e.target.value}:x)})}/></label>
        <label>Decisão<select value={r.status} onChange={e=>{const status=e.target.value as typeof r.status;set({legalStatus:status==="APPROVED"?"APPROVED":status==="APPROVED_WITH_REMARKS"?"REMARKS":status==="REJECTED"?"REJECTED":"PENDING",legalReviews:w.legalReviews.map((x,j)=>j===i?{...x,status,reviewedAt:status==="PENDING"?"":now()}:x)})}}>{["PENDING","APPROVED","APPROVED_WITH_REMARKS","NEEDS_DOCUMENTS","REJECTED"].map(x=><option key={x} value={x}>{reviewLabels[x]}</option>)}</select></label>
      </div>
      <label>Observações<textarea value={r.observations} onChange={e=>set({legalReviews:w.legalReviews.map((x,j)=>j===i?{...x,observations:e.target.value}:x)})}/></label>
    </article>)}
    <button onClick={()=>onContinue("Precificação")}>Ir para precificação</button>
  </div>;

  if (mode === "Precificação") return <div className={styles.form}>
    <p>Cálculos determinísticos: valor disponível = bruto − deduções − gravames; oferta = disponível × (1 − margem) − custos.</p>
    <button onClick={()=>{const base={grossAmount:w.credit.grossAmount,deductions:0,encumbrances:0,transactionCosts:0,targetMarginPercent:20};const result=calculatePricing(base);set({commercialStatus:"PRICING",pricingScenarios:[...w.pricingScenarios,{id:crypto.randomUUID(),name:"BASE",...base,...result,createdAt:now(),assumptions:"Cenário indicativo sujeito à conferência documental e jurídica."}]})}}><Plus size={16}/> Criar cenário base</button>
    {w.pricingScenarios.map((scenario,scenarioIndex)=>{
      const update=(fieldKey:keyof typeof scenario,numericValue:number)=>{const next={...scenario,[fieldKey]:numericValue};const calculated=calculatePricing(next);set({pricingScenarios:w.pricingScenarios.map((item,index)=>index===scenarioIndex?{...next,...calculated}:item)})};
      return <article className={styles.proposal} key={scenario.id}>
        <h3>Cenário {scenario.name}</h3>
        <p>Valor de referência: <b>{money(scenario.grossAmount)}</b></p>
        <div className={styles.fields}>{([['grossAmount','Valor bruto'],['deductions','Descontos / deduções'],['encumbrances','Gravames / ajustes'],['transactionCosts','Custos'],['targetMarginPercent','Margem alvo (%)']] as const).map(([fieldKey,label])=><label key={fieldKey}>{label}<input type="number" min="0" value={scenario[fieldKey]} onChange={event=>update(fieldKey,Number(event.target.value))}/></label>)}</div>
        <p>Premissas: {scenario.assumptions}</p>
        <p>Resultado: disponível estimado <b>{money(scenario.availableAmount)}</b> · oferta indicativa <b>{money(scenario.offerAmount)}</b>. Sem oferta vinculante ou decisão automática.</p>
      </article>;
    })}
    {isDemo && <button onClick={()=>onContinue("Negociação")}>Registrar proposta/oferta</button>}
  </div>;

  if (mode === "Negociação") return <div className={styles.form}>
    <button onClick={()=>{const scenario=w.pricingScenarios.at(-1);set({commercialStatus:"OFFERED",negotiations:[...w.negotiations,{id:crypto.randomUUID(),type:"OFFER",amount:scenario?.offerAmount||0,at:now(),author:w.nextAction.owner||"Responsável não atribuído",conditions:"Proposta demonstrativa sujeita à revisão humana e confirmação das premissas."}]})}}><Plus size={16}/> Nova proposta/oferta</button>
    {w.negotiations.map((negotiation,index)=><article className={styles.proposal} key={negotiation.id}>
      <h3>{negotiation.type==="OFFER"?"Proposta / oferta":negotiation.type.replaceAll("_"," ")}</h3>
      <div className={styles.fields}>
        <label>Estado<input readOnly value={negotiation.type}/></label>
        <label>Valor<input type="number" min="0" value={negotiation.amount} onChange={event=>set({negotiations:w.negotiations.map((item,itemIndex)=>itemIndex===index?{...item,amount:Number(event.target.value)}:item)})}/></label>
        <label>Criada por<input value={negotiation.author||"Não informado"} onChange={event=>set({negotiations:w.negotiations.map((item,itemIndex)=>itemIndex===index?{...item,author:event.target.value}:item)})}/></label>
        <label>Data e hora<input readOnly value={new Date(negotiation.at).toLocaleString("pt-BR")}/></label>
      </div>
      <label>Condições<textarea value={negotiation.conditions} onChange={event=>set({negotiations:w.negotiations.map((item,itemIndex)=>itemIndex===index?{...item,conditions:event.target.value}:item)})}/></label>
    </article>)}
    {isDemo && <><p>Salve a operação para persistir a proposta e auditar a alteração.</p><button onClick={()=>onContinue("Cessão")}>Continuar operação</button></>}
  </div>;

  if (mode === "Cessão") return <div className={styles.form}><div className={styles.notice}><CheckCircle2/><div><b>Coordenação da cessão</b><p>O CP registra checklist e marcos. Assinatura, protocolo e pagamento dependem de ação humana ou conector configurado.</p></div></div><label>Marco atual<select value={w.cessionStatus} onChange={e=>set({cessionStatus:e.target.value as OperationalWorkflow["cessionStatus"]})}>{["NOT_STARTED","DOCUMENT_CHECK","LEGAL_APPROVAL","FORMALIZATION","PROTOCOL","COMMUNICATION","MONITORING","COMPLETED","CANCELLED"].map(x=><option key={x}>{x}</option>)}</select></label></div>;

  if (mode === "Inteligência") return <IntelligencePanel />;

  return <div className={styles.form}><button onClick={()=>set({monitoring:[...w.monitoring,{id:crypto.randomUUID(),date:now(),type:"OUTRO",source:"Registro interno",description:"",importance:"MEDIUM",reviewed:false}]})}><Plus size={16}/> Registrar evento</button>{w.monitoring.map((m,i)=><article className={styles.event} key={m.id}><AlertTriangle size={16}/><div><b>{m.type.replaceAll("_"," ")}</b><textarea aria-label="Descrição do evento" value={m.description} onChange={e=>set({monitoring:w.monitoring.map((x,j)=>j===i?{...x,description:e.target.value}:x)})}/><label><input type="checkbox" checked={m.reviewed} onChange={e=>set({monitoring:w.monitoring.map((x,j)=>j===i?{...x,reviewed:e.target.checked}:x)})}/> Evento revisado</label></div></article>)}</div>;
}
