import { randomBytes } from "node:crypto";
import { betterAuth, APIError } from "better-auth";
import { organization, twoFactor } from "better-auth/plugins";
import { deliverAuthMail } from "./auth-mail";
import { LibsqlDialect } from "@libsql/kysely-libsql";

const production = process.env.NODE_ENV === "production";
const configuredSecret = process.env.BETTER_AUTH_SECRET;
export function authIsConfigured() {
  return !production || Boolean(configuredSecret && configuredSecret.length >= 32 && process.env.BETTER_AUTH_URL);
}
export function assertAuthConfigured() {
  if (!authIsConfigured()) throw Response.json({error:"Autenticação indisponível: configuração de produção incompleta."},{status:503});
}
const processState = globalThis as typeof globalThis & { cpAuthDevSecret?: string };
// The fallback only lets builds/dev initialize. Public handlers fail closed in
// production through assertAuthConfigured until persistent settings exist.
const secret = configuredSecret || (processState.cpAuthDevSecret ??= randomBytes(48).toString("base64url"));

export const auth = betterAuth({
  appName: "Central Precatórios",
  secret,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  database: {
    dialect: new LibsqlDialect({
      url: process.env.DATABASE_URL || "file:central-precatorios.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    }),
    type: "sqlite",
  },
  emailAndPassword: { enabled: true, minPasswordLength: 12, maxPasswordLength: 128, requireEmailVerification: production, sendResetPassword: async ({user,url})=>deliverAuthMail({to:user.email,url,kind:"RESET_PASSWORD"}), resetPasswordTokenExpiresIn: 60*30 },
  emailVerification:{sendVerificationEmail:async({user,url})=>deliverAuthMail({to:user.email,url,kind:"VERIFY_EMAIL"}),sendOnSignUp:true,expiresIn:60*60*24},
  session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  rateLimit: { enabled: true, storage: "database", window: 60, max: 60 },
  plugins: [twoFactor({issuer:"Central Precatórios"}),organization({
    requireEmailVerificationOnInvitation: true,
    organizationHooks: {
      beforeCreateInvitation: async () => {
        throw new APIError("FORBIDDEN", { message: "Convites indisponíveis até configurar verificação de e-mail." });
      },
    },
  })],
});
