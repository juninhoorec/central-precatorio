import { describe, expect, it } from "vitest";
import { roleHasPermission } from "./tenant";
describe("RBAC",()=>{
  it("mantém leitura para membro e bloqueia mutação",()=>{expect(roleHasPermission("member","operation:read")).toBe(true);expect(roleHasPermission("member","operation:write")).toBe(false)});
  it("permite gestão completa ao proprietário",()=>{expect(roleHasPermission("owner","operation:write")).toBe(true);expect(roleHasPermission("owner","legal:review")).toBe(true)});
});
