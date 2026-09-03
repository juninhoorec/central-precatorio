export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export function readAttribution(params: URLSearchParams) {
  return Object.fromEntries(
    UTM_KEYS.map((k) => [k, params.get(k)]).filter(([, v]) => v),
  );
}
