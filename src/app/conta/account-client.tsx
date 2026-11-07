"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import styles from "./account.module.css";

export default function AccountClient() {
  const router = useRouter();
  const { data: session, isPending, error: sessionError } = authClient.useSession();
  const { data: organizations, refetch: reloadOrganizations } = authClient.useListOrganizations();
  const { data: active, refetch: reloadActive } = authClient.useActiveOrganization();
  const [signup, setSignup] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function act(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível concluir. Tente novamente."); }
    finally { setBusy(false); }
  }
  function checked(result: { error?: { message?: string } | null }) {
    if (result.error) throw Error(result.error.message || "Não foi possível concluir esta solicitação.");
  }

  return (
    <main className={styles.page}>
      {/* ── LOGO ── */}
      <Link href="/" className={styles.brand}>
        <Image
          src="/brand/central-precatorios-symbol.jpg"
          alt="CP"
          width={48}
          height={48}
          className={styles.brandLogo}
          priority
        />
        <div className={styles.brandText}>
          <span className={styles.brandName}>Central Precatórios</span>
          <span className={styles.brandSub}>Inteligência para aquisição</span>
        </div>
      </Link>

      {/* ── HEADING ── */}
      <div className={styles.heading}>
        <span className={styles.eyebrow}>Seu espaço de trabalho</span>
        <h1>{session ? `Olá, ${session.user.name.split(" ")[0]}.` : "Uma conta. Sua operação."}</h1>
        <p>{session ? "Selecione a empresa com a qual deseja trabalhar." : "Entre para organizar oportunidades e acompanhar cada próximo passo."}</p>
      </div>

      {/* ── CONTEÚDO ── */}
      {isPending ? (
        <p role="status" style={{ color: "#94A3B8", fontSize: "0.85rem" }}>Verificando sua sessão…</p>
      ) : sessionError ? (
        <p role="alert" style={{ color: "#fca5a5", fontSize: "0.85rem" }}>Não foi possível verificar a sessão. Recarregue a página.</p>
      ) : !session ? (
        /* ── LOGIN / CADASTRO ── */
        <section className={styles.card}>
          <h2>{recovery ? "Recuperar acesso" : signup ? "Criar conta" : "Entrar"}</h2>

          {recovery ? (
            <form onSubmit={e => { e.preventDefault(); const email = String(new FormData(e.currentTarget).get("email")); void act(async () => { checked(await authClient.requestPasswordReset({ email, redirectTo: "/conta/redefinir-senha" })); setMessage("Se existir uma conta para este e-mail, as instruções serão enviadas."); }); }}>
              <fieldset disabled={busy}>
                <label>E-mail<input type="email" name="email" required autoComplete="email" maxLength={254} placeholder="seu@email.com" /></label>
                <button type="submit">{busy ? "Enviando…" : "Solicitar recuperação"}</button>
              </fieldset>
            </form>
          ) : (
            <>
              <form onSubmit={e => { e.preventDefault(); const data = new FormData(e.currentTarget); void act(async () => { const email = String(data.get("email")); const password = String(data.get("password")); checked(signup ? await authClient.signUp.email({ name: String(data.get("name")), email, password }) : await authClient.signIn.email({ email, password })); }); }}>
                <fieldset disabled={busy}>
                  {signup && <label>Seu nome<input name="name" required maxLength={100} autoComplete="name" placeholder="Nome completo" /></label>}
                  <label>E-mail<input type="email" name="email" required autoComplete="email" maxLength={254} placeholder="seu@email.com" /></label>
                  <label>Senha<input type="password" name="password" required minLength={signup ? 12 : 1} maxLength={128} autoComplete={signup ? "new-password" : "current-password"} placeholder={signup ? "Mínimo 12 caracteres" : "Sua senha"} /></label>
                  {signup && <small>Use pelo menos 12 caracteres.</small>}
                  <button type="submit">{busy ? "Aguarde…" : signup ? "Criar conta" : "Entrar na minha conta"}</button>
                </fieldset>
              </form>
              <button className={styles.secondary} disabled={busy} onClick={() => { setSignup(!signup); setError(""); }}>
                {signup ? "Já tenho uma conta" : "Ainda não tenho conta"}
              </button>
              {!signup && (
                <button className={styles.secondary} disabled={busy} onClick={() => { setRecovery(true); setError(""); }}>
                  Esqueci minha senha
                </button>
              )}
            </>
          )}
          {recovery && (
            <button className={styles.secondary} disabled={busy} onClick={() => setRecovery(false)}>
              Voltar para entrar
            </button>
          )}
        </section>
      ) : (
        /* ── ORGANIZAÇÕES ── */
        <div className={styles.grid}>
          <section className={styles.card}>
            <h2>Minhas organizações</h2>
            {!organizations?.length && (
              <p style={{ color: "#64748B", fontSize: "0.82rem", textAlign: "center", margin: "8px 0 12px" }}>
                Crie sua primeira organização para abrir a mesa de operações.
              </p>
            )}
            {organizations?.map(org => (
              <button
                className={styles.organization}
                key={org.id}
                disabled={busy}
                aria-pressed={active?.id === org.id}
                onClick={() => void act(async () => {
                  checked(await authClient.organization.setActive({ organizationId: org.id }));
                  await reloadActive();
                  setMessage("Organização selecionada.");
                })}
              >
                <strong title={org.name}>{org.name}</strong>
                <span>{active?.id === org.id ? "✓ Selecionada" : "Selecionar →"}</span>
              </button>
            ))}
            {active && (
              <Link href="/workspace" className={styles.open}>
                Abrir mesa de {active.name} →
              </Link>
            )}

            <h3>Nova organização</h3>
            <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const data = new FormData(form); void act(async () => { const result = await authClient.organization.create({ name: String(data.get("organization")), slug: String(data.get("slug")).toLowerCase() }); checked(result); if (result.data) checked(await authClient.organization.setActive({ organizationId: result.data.id })); await reloadOrganizations(); await reloadActive(); form.reset(); setMessage("Organização criada."); }); }}>
              <fieldset disabled={busy}>
                <label>Nome da empresa<input name="organization" required minLength={2} maxLength={100} placeholder="Minha Empresa" /></label>
                <label>
                  Identificador
                  <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} placeholder="minha-empresa" />
                  <small>Letras minúsculas, números e hífens.</small>
                </label>
                <button>Criar organização</button>
              </fieldset>
            </form>
          </section>

          <section className={styles.card}>
            <h2>Equipe & Conta</h2>
            {active ? (
              <>
                <p style={{ fontSize: "0.78rem", color: "#E8AA42", fontWeight: 700, margin: "0 0 10px" }}>{active.name}</p>
                <ul className={styles.members}>
                  {active.members.map(member => (
                    <li key={member.id}>
                      <strong>{member.user.name}</strong>
                      <span>{member.user.email}</span>
                      <small>{member.role === "owner" ? "Proprietário" : member.role === "admin" ? "Administrador" : "Membro"}</small>
                      {member.userId !== session.user.id && (
                        <button className={styles.secondary} disabled={busy} onClick={() => {
                          if (window.confirm(`Remover o acesso de ${member.user.name}?`))
                            void act(async () => { checked(await authClient.organization.removeMember({ memberIdOrEmail: member.id, organizationId: active.id })); await reloadActive(); });
                        }}>
                          Remover acesso
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p style={{ fontSize: "0.82rem", color: "#64748B", textAlign: "center" }}>Selecione uma organização para consultar os membros.</p>
            )}
            <hr />
            <h3>Segurança</h3>
            <p className={styles.note}>
              E-mail {session.user.emailVerified ? "verificado" : "com verificação pendente"}. Conectado como {session.user.email}.
            </p>
            {!session.user.emailVerified && (
              <button className={styles.secondary} disabled={busy} onClick={() => void act(async () => { checked(await authClient.sendVerificationEmail({ email: session.user.email, callbackURL: "/conta" })); setMessage("Link de verificação enviado."); })}>
                Enviar verificação de e-mail
              </button>
            )}
            <hr />
            <button className={styles.secondary} disabled={busy} onClick={() => void act(async () => { checked(await authClient.signOut()); router.refresh(); })}>
              Sair da conta
            </button>
          </section>
        </div>
      )}

      {error && <p className={styles.error} role="alert">{error}</p>}
      {message && <p className={styles.success} role="status">{message}</p>}

      <p className={styles.footer}>
        <Link href="/privacidade">Privacidade</Link> · <Link href="/termos">Termos de uso</Link>
      </p>
    </main>
  );
}
