"use client";

import { useEffect, useState } from "react";
import DuplicateReviewPanel from "../duplicate-review-panel";

export default function DuplicateReview() {
  const [items, setItems] = useState<never[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/operations", { cache: "no-store" }).then(async (response) => { if (!response.ok) throw new Error("Não foi possível carregar as operações."); return response.json(); }).then((data) => setItems(data.operations || [])).catch((cause) => setError(cause instanceof Error ? cause.message : "Falha ao carregar.")); }, []);
  return <main style={{ maxWidth: 1100, margin: "2rem auto", padding: "0 1rem", fontFamily: "system-ui" }}><h1>Revisão de duplicidades</h1><p>As sugestões são auxiliares e nenhuma união é feita sem aprovação humana.</p>{error ? <p role="alert">{error}</p> : <DuplicateReviewPanel items={items} />}</main>;
}
