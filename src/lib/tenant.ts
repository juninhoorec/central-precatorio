import { assertAuthConfigured, auth } from "./auth";

function singleHeaderValue(headers: Headers, name: string): string | null {
  const value = headers.get(name)?.trim();
  if (!value) return null;
  const values = value.split(",").map(item => item.trim());
  if (values.length !== 1 || !values[0]) return "__AMBIGUOUS__";
  return values[0].toLowerCase();
}

export function requestOriginMatchesHost(headers: Headers) {
  const origin = headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const hostValue = singleHeaderValue(headers, "host");
    const forwardedHostValue = singleHeaderValue(headers, "x-forwarded-host");
    const forwardedProtocol = singleHeaderValue(headers, "x-forwarded-proto");
    if (hostValue === "__AMBIGUOUS__" || forwardedHostValue === "__AMBIGUOUS__" || forwardedProtocol === "__AMBIGUOUS__") return false;
    const host = hostValue ?? forwardedHostValue;
    return (!host || parsed.host.toLowerCase() === host)
      && (!forwardedProtocol || parsed.protocol === `${forwardedProtocol}:`);
  } catch {
    return false;
  }
}

export async function requireTenant(headers: Headers): Promise<{ organizationId: string; userId: string; role: string }> {
  if (!requestOriginMatchesHost(headers)) throw Response.json({ error: "Origem não autorizada." }, { status: 403 });
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

export type TenantPermission = "operation:read" | "operation:write" | "document:read" | "document:upload" | "document:review" | "legal:review" | "audit:read" | "demo:manage" | "crm:read" | "crm:write" | "task:read" | "task:write" | "research:run" | "ai:reconfirm" | "ai:pilot:read" | "ai:pilot:write" | "automation:run";
const allTenantPermissions: readonly TenantPermission[] = [
  "operation:read", "operation:write", "document:read", "document:upload", "document:review",
  "legal:review", "audit:read", "demo:manage", "crm:read", "crm:write", "task:read",
  "task:write", "research:run", "ai:reconfirm", "ai:pilot:read", "ai:pilot:write", "automation:run",
];
const rolePermissions: Record<string, readonly TenantPermission[]> = {
  owner: allTenantPermissions,
  admin: allTenantPermissions,
  analyst: ["operation:read","operation:write","document:read","document:upload","document:review","crm:read","crm:write","task:read","task:write","research:run","ai:reconfirm","automation:run"],
  commercial: ["operation:read","operation:write","document:read","crm:read","crm:write"],
  legal: ["operation:read","document:read","legal:review"],
  read_only: ["operation:read","document:read","crm:read"],
  member: ["operation:read","document:read","crm:read"],
};
export function roleHasPermission(role:string, permission:TenantPermission) { return Boolean(rolePermissions[role.toLowerCase()]?.includes(permission)); }
export async function requireTenantPermission(headers:Headers, permission:TenantPermission) {
  const tenant = await requireTenant(headers);
  if (!roleHasPermission(tenant.role, permission)) throw Response.json({error:"Seu perfil não possui permissão para esta ação."},{status:403});
  return tenant;
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) {
    throw Response.json({ error: "Origem não autorizada." }, { status: 403 });
  }
}
