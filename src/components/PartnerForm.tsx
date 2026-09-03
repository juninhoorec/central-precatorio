"use client";
import { useRef, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
export default function PartnerForm() {
  const key = useRef(crypto.randomUUID());
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("sending");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch("/api/partners", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...data,
          idempotencyKey: key.current,
          landingPage: location.pathname,
        }),
      });
      if (!response.ok) throw new Error();
      setState("done");
    } catch {
      setState("error");
    }
  }
  if (state === "done")
    return (
      <div className="partner-form success-inline">
        <CheckCircle2 />
        <h2>Interesse registrado.</h2>
        <p>
          Entraremos em contato pelo canal informado para entender o perfil da
          operação.
        </p>
      </div>
    );
  return (
    <form className="partner-form" onSubmit={submit}>
      <span className="kicker">CADASTRO DE PARCEIRO</span>
      <h2>Vamos conhecer sua operação.</h2>
      <div className="form-two">
        <label>
          Empresa ou operação
          <input required name="company" minLength={2} />
        </label>
        <label>
          Seu nome
          <input required name="name" minLength={2} />
        </label>
      </div>
      <div className="form-two">
        <label>
          E-mail corporativo
          <input required name="email" type="email" />
        </label>
        <label>
          WhatsApp
          <input
            required
            name="phone"
            type="tel"
            inputMode="tel"
            pattern="\(?\d{2}\)?\s?9?\d{4}-?\d{4}"
          />
        </label>
      </div>
      <label>
        Perfil de interesse
        <select required name="profile">
          <option value="">Selecione</option>
          <option>Compra de precatórios</option>
          <option>Assessoria / originação</option>
          <option>Investimento</option>
          <option>Outro</option>
        </select>
      </label>
      <label className="partner-consent">
        <input required name="consent" type="checkbox" value="accepted" />
        <span>Autorizo o contato sobre parceria e confirmo que li a <a href="/privacidade" target="_blank">Política de Privacidade</a>. Os dados serão usados para avaliar e responder a esta solicitação.</span>
      </label>
      <input className="honeypot" name="website" tabIndex={-1} />
      {state === "error" ? (
        <p className="form-error">
          Não foi possível registrar agora. Tente novamente.
        </p>
      ) : null}
      <button disabled={state === "sending"} className="submit">
        {state === "sending" ? "Registrando..." : "Enviar interesse"}
        <ArrowRight />
      </button>
    </form>
  );
}
