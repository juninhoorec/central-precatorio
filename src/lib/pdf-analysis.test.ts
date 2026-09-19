import {describe,expect,it}from"vitest";
import {detectPdfFields,extractPdfText}from"./pdf-analysis";

function onePagePdf(){const stream="BT /F1 12 Tf 50 700 Td (Processo 1000001-00.2020.8.26.0001 PRECATORIO PRC-CP-2026-991 DEPRE 000123 Oficio 1 R$ 250.000,00) Tj ET",objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",`<< /Length ${Buffer.byteLength(stream,"latin1")} >>\nstream\n${stream}\nendstream`];let out="%PDF-1.4\n";const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(out,"latin1"));out+=`${i+1} 0 obj\n${o}\nendobj\n`});const xref=Buffer.byteLength(out,"latin1");out+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n${offsets.slice(1).map(x=>`${String(x).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return new Uint8Array(Buffer.from(out,"latin1"))}

describe("PDF text field provenance",()=>{
 it("keeps exact evidence page, value, confidence and deterministic method",()=>{
  const fields=detectPdfFields(["página sem dado","Processo 1000001-00.2020.8.26.0001 Ofício 12/2024 DEPRE 000123 R$ 150.000,00"]);
  expect(fields.find(f=>f.field==="processNumber")).toMatchObject({value:"1000001-00.2020.8.26.0001",page:2,confidence:95,method:"pdf-text-regex-v1"});
  expect(fields.find(f=>f.field==="depreReference")?.page).toBe(2);
  expect(fields.find(f=>f.field==="currency")?.value).toBe("R$ 150.000,00");
 });
 it("does not invent any field when no known identifier is present",()=>expect(detectPdfFields(["Texto genérico sem número, data ou valor"])).toEqual([]));
 it("extracts embedded PDF text and keeps page boundaries",async()=>{const result=await extractPdfText(onePagePdf());expect(result.pageCount).toBe(1);expect(result.pages[0]).toContain("1000001-00.2020.8.26.0001")});
});
