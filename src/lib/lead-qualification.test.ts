import {describe,expect,it} from "vitest";
import {createDefaultWorkflow} from "./operational-workflow";
import {defaultAcquisitionProfile,evaluateAcquisitionReadiness,evaluateLead,findLeadDuplicates} from "./lead-qualification";

function candidate(amount:number,type="PRECATORY"){
 const workflow=createDefaultWorkflow(amount);workflow.credit.debtorState="SP";workflow.credit.precatoryNumber="CP-TEST-0001";workflow.credit.numeroProcessoDEPRE="0032722-57.2014.8.26.0500";workflow.credit.numeroProcessoDEPRENormalizado="00327225720148260500";workflow.credit.qualityOffices[0].status="VALIDADO_PARA_TRIAGEM";workflow.credit.qualityOffices[1].status="VALIDADO_PARA_TRIAGEM";
 return{type,amount,debtor:"Município demonstrativo",tribunal:"TJSP",process:"PROCESSO-TESTE-001",workflow,checkedAt:new Date().toISOString()};
}
describe("CP Lead Center operational qualification",()=>{
 it("marks an in-profile precatory with two company documents qualified",()=>expect(evaluateLead(candidate(150000)).status).toBe("QUALIFICADO"));
 it("marks a below-profile precatory commercially unqualified",()=>expect(evaluateLead(candidate(80000)).status).toBe("NAO_QUALIFICADO"));
 it("routes an RPV to private review without the precatory minimum",()=>{const result=evaluateLead(candidate(50000,"RPV"));expect(result.status).toBe("RPV_ANALISE_PARTICULAR");expect(result.criteria[0].ok).toBe(true)});
 it("flags a missing company document as a pending qualification",()=>{const item=candidate(150000);item.workflow.credit.qualityOffices[1].status="PENDENTE";expect(evaluateLead(item).status).toBe("QUALIFICADO_COM_PENDENCIAS")});
 it("identifies exact duplicates without merging them",()=>{const a=candidate(150000),b=candidate(200000);b.workflow.credit.precatoryYear=a.workflow.credit.precatoryYear;expect(findLeadDuplicates([a,b]).size).toBe(2)});
 it("uses Nº Processo DEPRE as a primary duplicate identifier",()=>{const a=candidate(150000),b=candidate(200000);a.workflow.credit.precatoryNumber="";b.workflow.credit.precatoryNumber="";b.workflow.credit.numeroProcessoDEPRE="0032722-57.2014.8.26.0500";b.workflow.credit.numeroProcessoDEPRENormalizado="00327225720148260500";expect(findLeadDuplicates([a,b]).size).toBe(2)});
 it("qualifies identity with the explicit DEPRE process field",()=>{const item=candidate(150000);item.workflow.credit.precatoryNumber="";item.workflow.credit.numeroProcessoDEPRE="0032722-57.2014.8.26.0500";expect(evaluateLead(item).criteria.find(criterion=>criterion.key==="identifiers")?.label).toBe("Identificadores")});
 it("keeps default business threshold configurable in the profile",()=>expect(defaultAcquisitionProfile.minimumPrecatory).toBe(100000));
});

const autonomousCase={creditorName:"Credor sintético",amount:150000,minimumAmount:100000,numeroProcessoDEPRE:"DEMO-DEPRE-001",debtor:"Município demonstrativo",debtorState:"SP",tribunal:"TJSP",targetState:"SP",targetTribunal:"TJSP",officialEvidenceCount:2,requiredOfficialEvidence:2,identityConflict:false,contactAvailable:false};
describe("autonomous acquisition readiness",()=>{
 it("requires the mandatory gates but does not require contact",()=>{const result=evaluateAcquisitionReadiness(autonomousCase);expect(result.state).toBe("READY_FOR_ANALYST");expect(result.ready).toBe(true);expect(result.criteria.find(item=>item.key==="contact")).toMatchObject({mandatory:false,ok:false})});
 it("keeps one official document pending until the configured two are present",()=>{const result=evaluateAcquisitionReadiness({...autonomousCase,officialEvidenceCount:1});expect(result.state).toBe("QUALIFIED_WITH_PENDING");expect(result.reasons).toContain("OFFICIAL_EVIDENCE_INSUFFICIENT")});
 it("rejects a value below the commercial minimum",()=>{const result=evaluateAcquisitionReadiness({...autonomousCase,amount:99999.99});expect(result.state).toBe("REJECTED");expect(result.reasons).toContain("BELOW_MINIMUM_VALUE")});
 it("does not qualify a zero or missing value",()=>{expect(evaluateAcquisitionReadiness({...autonomousCase,amount:0}).state).toBe("REJECTED");expect(evaluateAcquisitionReadiness({...autonomousCase,amount:null}).state).toBe("WAITING")});
 it("waits when DEPRE or creditor is missing",()=>{expect(evaluateAcquisitionReadiness({...autonomousCase,numeroProcessoDEPRE:""}).reasons).toContain("MISSING_DEPRE");expect(evaluateAcquisitionReadiness({...autonomousCase,creditorName:""}).reasons).toContain("CREDITOR_NOT_IDENTIFIED")});
 it("rejects cases outside the configured SP commercial profile",()=>{const result=evaluateAcquisitionReadiness({...autonomousCase,debtorState:"RJ",tribunal:"TJRJ"});expect(result.state).toBe("REJECTED");expect(result.reasons).toContain("OUTSIDE_SAO_PAULO_PROFILE")});
 it("holds critical identity conflicts for review",()=>{const result=evaluateAcquisitionReadiness({...autonomousCase,identityConflict:true});expect(result.state).toBe("WAITING");expect(result.reasons).toContain("IDENTITY_CONFLICT")});
});
