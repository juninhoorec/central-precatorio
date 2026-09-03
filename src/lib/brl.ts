export function parseBrl(value: string) {
  const cleaned = value.trim().replace(/R\$/gi, "").replace(/\s/g, "");
  if (!cleaned) return 0;
  let normalized = cleaned;
  if (cleaned.includes(",")) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}
