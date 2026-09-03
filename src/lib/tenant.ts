import { assertAuthConfigured, auth } from "./auth";

export async function requireTenant(headers: Headers): Promise<{ organizationId: string; userId: string; role: string }> {
  assertAuthConfigured();
  const session = await auth.api.getSession({ headers });
  if (!session) throw Response.json({ error: "Entre na sua conta para continuar." }, { status: 401 });
  const organizationId = session.session.activeOrganizationId;
  if (!organizationId) throw Response.json({ error: "Selecione uma organização em Minha conta." }, { status: 403 });
  const member = await auth.api.getActiveMember({ headers }).catch(() => null);
  if (!member || member.organizationId !== organizationId || member.userId !== session.user.id) {
    throw Response.json({ error: "Você não possui acesso a esta organização." }, { status: 403 });
  }
  return { organizationId, userId: session.user.id, role: member.role };
}

export type TenantPermission = "operation:read" | "operation:write" | "document:read" | "document:upload" | "document:review" | "legal:review" | "audit:read" | "demo:manage";
const rolePermissions: Record<string, readonly TenantPermission[]> = {
  owner: ["operation:read","operation:write","document:read","document:upload","document:review","legal:review","audit:read","demo:manage"],
  admin: ["operation:read","operation:write","document:read","document:upload","document:review","legal:review","audit:read","demo:manage"],
  analyst: ["operation:read","operation:write","document:read","document:upload","document:review"],
  commercial: ["operation:read","operation:write","document:read"],
  legal: ["operation:read","document:read","legal:review"],
  read_only: ["operation:read","document:read"],
  member: ["operation:read","document:read"],
};
export function roleHasPermission(role:string, permission:TenantPermission) { return Boolean(rolePermissions[role.toLowerCase()]?.includes(permission)); }
export async function requireTenantPermission(headers:Headers, permission:TenantPermission) {
  const tenant = await requireTenant(headers);
  if (!roleHasPermission(tenant.role, permission)) throw Response.json({error:"Seu perfil não possui permissão para esta ação."},{status:403});
  return tenant;
}
