"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Calculator,
  Check,
  Clipboard,
  Download,
  FileCheck2,
  Scale,
} from "lucide-react";
import styles from "./negociacao.module.css";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const defaultItems = [
  "Número do processo ou do precatório",
  "Ofício requisitório",
  "Cálculo ou valor atualizado",
  "Documento que indique o ente devedor",
  "Informação sobre cessões, penhoras ou bloqueios",
  "Contrato de honorários, quando aplicável",
];

type Offer = { name: string; price: string; holderCosts: string };

function amount(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function maximumPrice(receipt: number, annualRate: number, months: number, costs: number) {
  const presentValue = receipt / Math.pow(1 + annualRate / 100, months / 12);
  return Math.max(0, presentValue - costs);
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.moneyInput}>
        <b aria-hidden="true">R$</b>
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} em reais`}
        />
      </div>
    </label>
  );
}

export default function NegotiationTool() {
  const [receipt, setReceipt] = useState("500000");
  const [targetReturn, setTargetReturn] = useState("18");
  const [months, setMonths] = useState("24");
  const [operationCosts, setOperationCosts] = useState("18000");
  const [offers, setOffers] = useState<Offer[]>([
    { name: "Oferta A", price: "310000", holderCosts: "0" },
    { name: "Oferta B", price: "325000", holderCosts: "12000" },
    { name: "Oferta C", price: "300000", holderCosts: "3500" },
  ]);
  const [checked, setChecked] = useState(defaultItems.map(() => true));
  const [message, setMessage] = useState(
    "Olá! Para organizar a análise do precatório, poderia enviar os documentos e informações listados abaixo?\n\n" +
      defaultItems.map((item) => `• ${item}`).join("\n") +
      "\n\nNão envie senhas ou dados bancários. Caso algum item não esteja disponível, basta informar.",
  );
  const [copyState, setCopyState] = useState("");

  const result = useMemo(() => {
    const expectedReceipt = amount(receipt);
    const rate = amount(targetReturn);
    const duration = Math.max(1, amount(months));
    const costs = amount(operationCosts);
    return {
      price: maximumPrice(expectedReceipt, rate, duration, costs),
      sensitivity: [12, 24, 36, 48].map((period) => ({
        period,
        price: maximumPrice(expectedReceipt, rate, period, costs),
      })),
    };
  }, [months, operationCosts, receipt, targetReturn]);

  const rankedOffers = useMemo(
    () =>
      offers
        .map((offer, index) => ({
          ...offer,
          index,
          net: Math.max(0, amount(offer.price) - amount(offer.holderCosts)),
        }))
        .sort((a, b) => b.net - a.net),
    [offers],
  );

  function updateOffer(index: number, key: keyof Offer, value: string) {
    setOffers((current) => current.map((offer, position) => (position === index ? { ...offer, [key]: value } : offer)));
  }

  function regenerateMessage() {
    const selected = defaultItems.filter((_, index) => checked[index]);
    setMessage(
      "Olá! Para organizar a análise do precatório, poderia enviar os itens abaixo?\n\n" +
        (selected.length ? selected.map((item) => `• ${item}`).join("\n") : "• Informe quais documentos estão disponíveis") +
        "\n\nNão envie senhas ou dados bancários. Caso algum item não esteja disponível, basta informar.",
    );
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopyState("Mensagem copiada.");
    } catch {
      setCopyState("Não foi possível copiar automaticamente. Selecione o texto manualmente.");
    }
  }

  function downloadMessage() {
    const url = URL.createObjectURL(new Blob([message], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "solicitacao-documental-precatorio.txt";
    anchor.click();
    URL.revokeObjectURL(url);
    setCopyState("Arquivo preparado para download.");
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}><Scale /><span>central<small>PRECATÓRIOS</small></span></Link>
        <nav aria-label="Navegação da ferramenta">
          <Link href="/ferramentas"><ArrowLeft /> Ferramentas</Link>
          <Link href="/workspace">Mesa interna <ArrowRight /></Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div><span>CP NEGOTIATION LAB · FERRAMENTA EDUCATIVA</span><h1>Negocie com premissas claras, não apenas com um número.</h1></div>
        <p>Estruture um preço máximo por retorno alvo, compare o valor líquido de ofertas e prepare uma solicitação documental — cálculos no navegador. Os valores iniciais são exemplos fictícios; substitua pelas premissas do seu caso.</p>
      </section>

      <div className={styles.workspace}>
        <section className={styles.card} aria-labelledby="max-price-title">
          <div className={styles.cardHead}><Calculator /><div><span>CENÁRIO DE AQUISIÇÃO</span><h2 id="max-price-title">Preço máximo por retorno alvo</h2></div></div>
          <div className={styles.inputGrid}>
            <MoneyInput label="Recebimento líquido projetado" value={receipt} onChange={setReceipt} />
            <label className={styles.field}><span>Retorno alvo anual</span><div className={styles.suffixInput}><input type="number" min="0" step="0.1" inputMode="decimal" value={targetReturn} onChange={(event) => setTargetReturn(event.target.value)} /><b aria-hidden="true">%</b></div></label>
            <label className={styles.field}><span>Prazo estimado</span><div className={styles.suffixInput}><input type="number" min="1" step="1" inputMode="numeric" value={months} onChange={(event) => setMonths(event.target.value)} /><b aria-hidden="true">meses</b></div></label>
            <MoneyInput label="Custos totais da operação" value={operationCosts} onChange={setOperationCosts} />
          </div>
          <div className={styles.mainResult} aria-live="polite"><span>PREÇO MÁXIMO ESTIMADO</span><strong>{currency.format(result.price)}</strong><p>Valor presente do recebimento, descontado pelo retorno alvo e pelos custos informados.</p></div>
          <div className={styles.sensitivity}><div><span>SENSIBILIDADE DE PRAZO</span><p>Mesmas premissas, alterando somente o prazo.</p></div><div className={styles.sensitivityGrid}>{result.sensitivity.map((item) => <article className={item.period === amount(months) ? styles.active : ""} key={item.period}><span>{item.period} meses</span><strong>{currency.format(item.price)}</strong></article>)}</div></div>
          <p className={styles.note}>Cálculo educativo. Não inclui automaticamente risco jurídico, tributos, atualização monetária, prioridade, liquidez ou outras condições da operação.</p>
        </section>

        <section className={styles.card} aria-labelledby="offers-title">
          <div className={styles.cardHead}><Scale /><div><span>COMPARAÇÃO LÍQUIDA</span><h2 id="offers-title">Compare até três ofertas</h2></div></div>
          <p className={styles.intro}>Informe quanto foi oferecido e os custos atribuídos ao titular. A maior oferta líquida aparece primeiro.</p>
          <div className={styles.offerInputs}>{offers.map((offer, index) => <fieldset key={index}><legend>Oferta {index + 1}</legend><label className={styles.field}><span>Identificação</span><input value={offer.name} onChange={(event) => updateOffer(index, "name", event.target.value)} /></label><MoneyInput label="Preço oferecido" value={offer.price} onChange={(value) => updateOffer(index, "price", value)} /><MoneyInput label="Custos do titular" value={offer.holderCosts} onChange={(value) => updateOffer(index, "holderCosts", value)} /></fieldset>)}</div>
          <div className={styles.ranking} aria-live="polite">{rankedOffers.map((offer, rank) => <article key={offer.index} className={rank === 0 ? styles.best : ""}><span>{rank === 0 ? <><Check /> MAIOR VALOR LÍQUIDO</> : `${rank + 1}º resultado`}</span><b>{offer.name || `Oferta ${offer.index + 1}`}</b><strong>{currency.format(offer.net)}</strong><small>{currency.format(amount(offer.price))} menos {currency.format(amount(offer.holderCosts))} em custos</small></article>)}</div>
        </section>

        <section className={`${styles.card} ${styles.documents}`} aria-labelledby="documents-title">
          <div className={styles.cardHead}><FileCheck2 /><div><span>PREPARAÇÃO DOCUMENTAL</span><h2 id="documents-title">Checklist e mensagem de solicitação</h2></div></div>
          <div className={styles.documentGrid}><div><p className={styles.intro}>Selecione os itens que deseja solicitar.</p><div className={styles.checklist}>{defaultItems.map((item, index) => <label key={item}><input type="checkbox" checked={checked[index]} onChange={() => setChecked((current) => current.map((value, position) => position === index ? !value : value))} /><span>{item}</span></label>)}</div><button type="button" className={styles.secondary} onClick={regenerateMessage}>Atualizar mensagem</button></div><div><label className={styles.messageLabel} htmlFor="document-message">Mensagem editável</label><textarea id="document-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={13} /><div className={styles.messageActions}><button type="button" onClick={copyMessage}><Clipboard /> Copiar texto</button><button type="button" onClick={downloadMessage}><Download /> Baixar .txt</button></div><p className={styles.status} role="status">{copyState}</p></div></div>
        </section>
      </div>
    </main>
  );
}
