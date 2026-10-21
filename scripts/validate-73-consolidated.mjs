import fs from 'node:fs';
import path from 'node:path';
import XLSX from 'xlsx';
const p='C:/Users/Junio Cavalcanti/Downloads/DEPRE_consolidado_recuperado_completo.xlsx';
const wb=XLSX.read(fs.readFileSync(p));
const rows=[];
for(const sheet of wb.SheetNames){for(const row of XLSX.utils.sheet_to_json(wb.Sheets[sheet],{defval:''})){const depre=String(row['DEPRE / Processo']||'').trim(); if(!depre) continue; const holder=String(row['Titular / Beneficiário']||row['Credor / Titular']||'').trim(); const doc=String(row['CPF / CNPJ']||'').trim(); const lawyer=String(row['Advogado']||'').trim(); rows.push({sheet,depre,holder,document:doc,lawyer,hasDepre:!!depre,hasHolder:!!holder,hasDocument:!!doc,hasLawyer:!!lawyer,minimumReview:'Valor/ofício/processo devem ser conferidos na fonte oficial'});}}
const report={generatedAt:new Date().toISOString(),records:rows.length,bySheet:Object.fromEntries(wb.SheetNames.map(s=>[s,rows.filter(r=>r.sheet===s).length])),withHolder:rows.filter(r=>r.hasHolder).length,withDocument:rows.filter(r=>r.hasDocument).length,withLawyer:rows.filter(r=>r.hasLawyer).length,missingDocument:rows.filter(r=>!r.hasDocument).length,missingHolder:rows.filter(r=>!r.hasHolder).length,readyForAnalyst:rows.filter(r=>r.hasDepre&&r.hasHolder).length,validationNote:'Pronto para análise manual, não certificado automaticamente.'};
fs.writeFileSync('data/validation-73-consolidated.json',JSON.stringify({report,rows},null,2));
console.log(JSON.stringify(report,null,2));
