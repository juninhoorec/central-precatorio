export const INITIAL_DEPRE_SOURCE = "TJSP/DEPRE · Pacote 73";

export function isInitialDepreStock(item: {
  source?: string | null;
  workflow?: { inventory?: { origin?: string | null } } | null;
}) {
  return item.workflow?.inventory?.origin === "INITIAL_73" || item.source === INITIAL_DEPRE_SOURCE;
}
