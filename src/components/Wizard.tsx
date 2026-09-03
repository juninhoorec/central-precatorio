"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Scale,
} from "lucide-react";
import { whatsappUrl } from "@/lib/contact";
import { readJson, writeJson } from "@/lib/browser-storage";

type Mode = "pre" | "assistant" | "simulator";
type Question = { key: string; prompt: string; options: readonly string[] };
type Config = { title: string; sub: string; questions: readonly Question[] };
const configs: Record<Mode, Config> = {
  pre: {
    title: "Pré-análise do seu precatório",
    sub: "Conte o que você sabe. Leva cerca de 3 minutos.",
    questions: [
      {
        key: "hasPrecat",
        prompt: "Você possui um precatório?",
        options: ["Sim, possuo", "Acredito que sim", "Não tenho certeza"],
      },
      {
        key: "valueRange",
        prompt: "Qual o valor aproximado?",
        options: [
          "Até R$ 100 mil",
          "R$ 100 mil a R$ 500 mil",
          "Acima de R$ 500 mil",
          "Não sei o valor",
        ],
      },
      {
        key: "debtor",
        prompt: "Quem deve pagar?",
        options: ["Estado", "Prefeitura", "União", "INSS", "Outro / Não sei"],
      },
      {
        key: "location",
        prompt: "Onde está localizado?",
        options: ["São Paulo", "Outro estado", "Não sei"],
      },
      {
        key: "processNumber",
        prompt: "Você tem o número do processo ou precatório?",
        options: ["Sim, tenho", "Ainda não"],
      },
      {
        key: "goal",
        prompt: "Qual o seu objetivo?",
        options: [
          "Avaliar antecipação",
          "Entender quanto pode valer",
          "Consultar a situação",
          "Entender como funciona",
        ],
      },
    ],
  },
  assistant: {
    title: "Assistente do Precatório",
    sub: "Vamos identificar o melhor próximo passo para você.",
    questions: [
      {
        key: "hasPrecat",
        prompt: "Você possui um precatório?",
        options: ["Sim, possuo", "Acredito que sim", "Não tenho certeza"],
      },
      {
        key: "valueRange",
        prompt: "Você sabe o valor aproximado?",
        options: ["Sim, tenho uma estimativa", "Não sei o valor"],
      },
      {
        key: "debtor",
        prompt: "Quem deve pagar?",
        options: ["Estado", "Prefeitura", "União", "INSS", "Outro / Não sei"],
      },
      {
        key: "goal",
        prompt: "O que você deseja agora?",
        options: [
          "Avaliar antecipação",
          "Entender quanto pode valer",
          "Saber a situação",
          "Entender como funciona",
        ],
      },
    ],
  },
  simulator: {
    title: "Simulador educativo",
    sub: "Entenda os fatores considerados em uma análise.",
    questions: [
      {
        key: "valueRange",
        prompt: "Qual o valor aproximado?",
        options: [
          "Até R$ 100 mil",
          "R$ 100 mil a R$ 500 mil",
          "Acima de R$ 500 mil",
          "Não sei o valor",
        ],
      },
      {
        key: "debtor",
        prompt: "Quem deve pagar?",
        options: ["Estado", "Prefeitura", "União", "INSS", "Outro / Não sei"],
      },
      {
        key: "status",
        prompt: "Você conhece a situação atual?",
        options: ["Sim", "Parcialmente", "Não"],
      },
      {
        key: "goal",
        prompt: "Qual seu principal interesse?",
        options: [
          "Avaliar antecipação",
          "Entender o processo",
          "Organizar informações",
        ],
      },
    ],
  },
};

export default function Wizard({ mode }: { mode: Mode }) {
  const config = configs[mode];
  const contactStep = config.questions.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [protocol, setProtocol] = useState("");
  const [showContact, setShowContact] = useState(mode !== "simulator");
  const idempotencyKey = useRef(crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = readJson<{
          version: number;
          step: number;
          answers: Record<string, string>;
        } | null>(`cp-${mode}`, null);
        if (saved?.version === 2) {
          setStep(Math.min(saved.step, contactStep));
          setAnswers(saved.answers);
        } else if (mode === "pre") {
          const seeded = new URLSearchParams(window.location.search).get(
            "possui",
          );
          if (seeded && config.questions[0].options.includes(seeded)) {
            setAnswers({ hasPrecat: seeded });
            setStep(1);
          }
        }
      } catch {
        localStorage.removeItem(`cp-${mode}`);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [mode, contactStep, config.questions]);
  useEffect(() => {
    if (step > 0) headingRef.current?.focus();
  }, [step, showContact]);
  function choose(value: string) {
    const question = config.questions[step];
    if (!question) return;
    const next = { ...answers, [question.key]: value };
    setAnswers(next);
    try {
      writeJson(`cp-${mode}`, { version: 2, step: step + 1, answers: next });
    } catch {}
    setStep((current) => Math.min(current + 1, contactStep));
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const payload = {
      idempotencyKey: idempotencyKey.current,
      mode,
      name: form.get("name"),
      phone: form.get("phone"),
      email: form.get("email"),
      website: form.get("website"),
      answers,
      attribution: {
        firstTouch: readJson("cp-attribution-first", {}),
        lastTouch: readJson("cp-attribution-last", {}),
      },
      consent: {
        accepted: true,
        version: "2026-09-06",
        acceptedAt: new Date().toISOString(),
      },
      landingPage: window.location.pathname,
    };
    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setProtocol(result.id.slice(0, 8).toUpperCase());
      localStorage.removeItem(`cp-${mode}`);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }
  if (status === "done")
    return (
      <main className="wizard-bg">
        <div className="success">
          <CheckCircle2 />
          <span>PRÉ-ANÁLISE RECEBIDA</span>
          <h1>Sua solicitação foi encaminhada para a analista responsável.</h1>
          <p>
            Protocolo <strong>{protocol}</strong>. Ela poderá entrar em contato
            pelo WhatsApp informado. Se preferir, inicie a conversa agora.
          </p>
          <a
            href={whatsappUrl(
              `Olá, enviei uma pré-análise pelo site. Meu protocolo é ${protocol}.`,
            )}
            target="_blank"
            rel="noopener noreferrer"
          >
            Continuar no WhatsApp
          </a>
          <br />
          <Link href="/">Voltar ao início</Link>
        </div>
      </main>
    );
  const question = config.questions[step];
  const educationalResult = mode === "simulator" && !question && !showContact;
  return (
    <main className="wizard-bg">
      <div className="wizard-nav">
        <Link href="/" className="brand">
          <span>
            <Scale />
          </span>
          <b>
            central<small>PRECATÓRIOS</small>
          </b>
        </Link>
        <span>
          <LockKeyhole /> Dados mínimos
        </span>
      </div>
      <div className="wizard-wrap">
        <div className="wizard-intro">
          <span>
            ETAPA {step + 1} DE {contactStep + 1}
          </span>
          <h1>{config.title}</h1>
          <p>{config.sub}</p>
          <div
            className="bar"
            role="progressbar"
            aria-valuemin={1}
            aria-valuemax={contactStep + 1}
            aria-valuenow={step + 1}
          >
            <i
              style={{ width: `${((step + 1) / (contactStep + 1)) * 100}%` }}
            />
          </div>
          <small>Seu progresso fica salvo neste dispositivo até o envio.</small>
        </div>
        <section className="question">
          <span className="stepnum">{String(step + 1).padStart(2, "0")}</span>
          <h2 ref={headingRef} tabIndex={-1}>
            {question?.prompt ||
              (educationalResult
                ? "Seu resultado educativo"
                : "Como podemos falar com você?")}
          </h2>
          {question ? (
            <div className="options" aria-label={question.prompt}>
              {question.options.map((option) => (
                <button
                  type="button"
                  aria-pressed={answers[question.key] === option}
                  className={answers[question.key] === option ? "active" : ""}
                  onClick={() => choose(option)}
                  key={option}
                >
                  <i />
                  {option}
                  <ArrowRight />
                </button>
              ))}
            </div>
          ) : educationalResult ? (
            <div className="simulation-result" aria-live="polite">
              <span>RESULTADO EDUCATIVO</span>
              <h3>
                Você já possui informações úteis para uma avaliação inicial.
              </h3>
              <p>
                O tipo de devedor, a faixa de valor e a situação do processo
                influenciam a análise. Qualquer valor depende de conferência
                documental e critérios do parceiro responsável.
              </p>
              <ul>
                <li>
                  Faixa informada: <strong>{answers.valueRange}</strong>
                </li>
                <li>
                  Devedor: <strong>{answers.debtor}</strong>
                </li>
                <li>
                  Situação conhecida: <strong>{answers.status}</strong>
                </li>
              </ul>
              <button className="submit" onClick={() => setShowContact(true)}>
                Solicitar análise personalizada <ArrowRight />
              </button>
            </div>
          ) : (
            <form onSubmit={submit}>
              <label>
                Nome completo
                <input
                  required
                  minLength={2}
                  name="name"
                  autoComplete="name"
                  placeholder="Como devemos chamar você?"
                />
              </label>
              <label>
                WhatsApp
                <input
                  required
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  pattern="\(?\d{2}\)?\s?9?\d{4}-?\d{4}"
                  placeholder="(11) 99999-9999"
                />
              </label>
              <label>
                E-mail <small>(opcional)</small>
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="voce@exemplo.com"
                />
              </label>
              <input
                className="honeypot"
                tabIndex={-1}
                autoComplete="off"
                name="website"
                aria-hidden="true"
              />
              <label className="consent">
                <input required type="checkbox" /> Autorizo o contato para esta
                análise e li a{" "}
                <Link href="/privacidade" target="_blank">
                  Política de Privacidade
                </Link>
                .
              </label>
              {status === "error" ? (
                <p className="form-error" role="alert">
                  Não foi possível enviar agora. Tente novamente ou fale conosco
                  pelo WhatsApp.
                </p>
              ) : null}
              <button disabled={status === "sending"} className="submit">
                {status === "sending"
                  ? "Enviando com segurança..."
                  : "Enviar para análise"}
                <ArrowRight />
              </button>
            </form>
          )}
          {step > 0 ? (
            <button
              className="back"
              onClick={() => setStep((current) => current - 1)}
            >
              <ArrowLeft /> Voltar
            </button>
          ) : null}
          <p className="disclaimer">
            {mode === "simulator"
              ? "Esta ferramenta é educativa e não representa proposta, garantia de compra ou valor definitivo."
              : "Não solicitamos CPF, senha ou dados bancários nesta etapa."}
          </p>
        </section>
      </div>
    </main>
  );
}
