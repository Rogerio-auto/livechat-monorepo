export function normalizeMsisdn(s: string) {
  if (!s) return "";
  const only = s.replace(/\D/g, "");
  return only.replace(/^00/, "");
}
