"use client";

import { useMemo, useState } from "react";
import { parseBrl } from "@/lib/brl";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default function DealEconomics() {
  const [nominal, setNominal] = useState("500000");
  const [purchase, setPurchase] = useState("300000");
  const [costs, setCosts] = useState("15000");
  const [netReceipt, setNetReceipt] = useState("480000");
  const [months, setMonths] = useState("24");

  const result = useMemo(() => {
    const capital = parseBrl(purchase) + parseBrl(costs);
    const receipt = parseBrl(netReceipt);
    const duration = Math.max(1, Number(months.replace(/\D/g, "")) || 1);
    const gain = receipt - capital;
    const roi = capital ? gain / capital : 0;
    const annualized = capital
      ? Math.pow(receipt / capital, 12 / duration) - 1
      : 0;
    const discount = parseBrl(nominal)
      ? 1 - parseBrl(purchase) / parseBrl(nominal)
      : 0;
    return { capital, gain, roi, annualized, discount };
  }, [nominal, purchase, costs, netReceipt, months]);

  return (
    <div className="economics-card">
      <div className="economics-fields">
        <label>Valor nominal estimado<input inputMode="decimal" value={nominal} onChange={(e) => setNominal(e.target.value)} /></label>
        <label>Preço de aquisição<input inputMode="decimal" value={purchase} onChange={(e) => setPurchase(e.target.value)} /></label>
        <label>Custos totais estimados<input inputMode="decimal" value={costs} onChange={(e) => setCosts(e.target.value)} /></label>
        <label>Recebimento líquido projetado<input inputMode="decimal" value={netReceipt} onChange={(e) => setNetReceipt(e.target.value)} /></label>
        <label>Prazo estimado em meses<input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} /></label>
      </div>
      <div className="economics-results" aria-live="polite">
        <article><span>Capital empregado</span><strong>{money.format(result.capital)}</strong></article>
        <article><span>Resultado bruto projetado</span><strong>{money.format(result.gain)}</strong></article>
        <article><span>Deságio sobre o nominal</span><strong>{(result.discount * 100).toFixed(1)}%</strong></article>
        <article><span>Retorno sobre capital</span><strong>{(result.roi * 100).toFixed(1)}%</strong></article>
        <article><span>Retorno anualizado estimado</span><strong>{(result.annualized * 100).toFixed(1)}%</strong></article>
      </div>
      <p className="calculation-note">Cenário matemático configurável. Não considera automaticamente tributos, atualização, risco jurídico, prioridade, compensações ou liquidez e não constitui oferta, recomendação ou promessa de retorno.</p>
    </div>
  );
}
