import {describe,expect,it} from "vitest";
import {profileTjspDataset} from "./tjsp-import";

describe("TJSP dataset profiling",()=>{
 it("profiles types, nulls, unique values, duplicates and identity candidates",()=>{
  const profile=profileTjspDataset([
   ["Credor","Número do processo","Valor atualizado","Data-base"],
   ["João da Silva","1000001-00.2020.8.26.0001","R$ 250.000,00","01/09/2026"],
   ["Maria Souza","1000002-00.2020.8.26.0001","R$ 120.000,00","02/09/2026"],
   ["Maria Souza","1000002-00.2020.8.26.0001","R$ 120.000,00","02/09/2026"],
   ["","","inconsistente",""],
  ]);
  expect(profile.recordCount).toBe(4);
  expect(profile.duplicateRows).toBe(1);
  expect(profile.candidateIdentityFields).toEqual(["Número do processo"]);
  expect(profile.fields[0]).toMatchObject({type:"TEXT",nullRate:0.25,uniqueRate:0.6667,samples:["JOAO DA SILVA","MARIA SOUZA"]});
  expect(profile.fields[1].nullRate).toBe(0.25);
  expect(profile.fields[2]).toMatchObject({type:"MIXED",malformed:1});
  expect(profile.fields[3].type).toBe("DATE");
 });

 it("returns a stable empty profile when the dataset has only headers",()=>{
    const profile=profileTjspDataset([["Credor","Valor"]]);
    expect(profile).toMatchObject({recordCount:0,duplicateRows:0});
    expect(profile.fields).toHaveLength(2);
    expect(profile.fields.every(field=>field.type==="EMPTY"&&field.nullRate===0&&field.uniqueRate===0&&field.malformed===0)).toBe(true);
 });
});