import { describe, expect, it } from "vitest";
import { requestOriginMatchesHost, roleHasPermission } from "./tenant";
describe("RBAC",()=>{
  it("mantém leitura para membro e bloqueia mutação",()=>{expect(roleHasPermission("member","operation:read")).toBe(true);expect(roleHasPermission("member","operation:write")).toBe(false)});
  it("permite gestão completa ao proprietário",()=>{expect(roleHasPermission("owner","operation:write")).toBe(true);expect(roleHasPermission("owner","legal:review")).toBe(true)});
  it("nega ações sensíveis para papéis sem concessão explícita",()=>{
    expect(roleHasPermission("member","task:read")).toBe(false);
    expect(roleHasPermission("commercial","research:run")).toBe(false);
    expect(roleHasPermission("unknown","automation:run")).toBe(false);
    expect(roleHasPermission("analyst","ai:pilot:write")).toBe(false);
    expect(roleHasPermission("analyst","research:run")).toBe(true);
    expect(roleHasPermission("admin","ai:pilot:write")).toBe(true);
  });
  it("detecta origens que divergem do host confiável da requisição",()=>{
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example",host:"cp.example"}))).toBe(true);
    expect(requestOriginMatchesHost(new Headers({origin:"https://attacker.example",host:"cp.example"}))).toBe(false);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example",host:"cp.example","x-forwarded-host":"attacker.example"}))).toBe(true);
    expect(requestOriginMatchesHost(new Headers({origin:"https://attacker.example",host:"cp.example","x-forwarded-host":"attacker.example"}))).toBe(false);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example",host:"cp.example","x-forwarded-host":"attacker.example, other.example"}))).toBe(false);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example"}))).toBe(true);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example","x-forwarded-host":"cp.example"}))).toBe(true);
    expect(requestOriginMatchesHost(new Headers({origin:"not a URL",host:"cp.example"}))).toBe(false);
  });
  it("faz o Host real predominar sobre X-Forwarded-Host",()=>{
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example",host:"cp.example","x-forwarded-host":"attacker.example"}))).toBe(true);
    expect(requestOriginMatchesHost(new Headers({origin:"https://attacker.example",host:"cp.example","x-forwarded-host":"attacker.example"}))).toBe(false);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example",host:"cp.example","x-forwarded-host":"attacker.example, cp.example"}))).toBe(false);
  });
  it("aceita apenas um valor único de X-Forwarded-Host como fallback",()=>{
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example","x-forwarded-host":"cp.example"}))).toBe(true);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example","x-forwarded-host":"cp.example, other.example"}))).toBe(false);
    expect(requestOriginMatchesHost(new Headers({origin:"https://cp.example","host":"","x-forwarded-host":"cp.example"}))).toBe(true);
  });
});
