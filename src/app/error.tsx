"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <span>ALGO SAIU DO FLUXO</span>
      <h1>Não foi possível carregar esta etapa.</h1>
      <p>Seus dados não foram enviados. Tente novamente com segurança.</p>
      <button onClick={reset}>Tentar novamente</button>
    </main>
  );
}
