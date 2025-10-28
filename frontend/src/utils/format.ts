export const onlyDigits = (s: string) => (s || "").replace(/\D/g, "");

export const formatCPF = (v: string) => {
  const s = onlyDigits(v).slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 6) return `${s.slice(0,3)}.${s.slice(3)}`;
  if (s.length <= 9) return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6)}`;
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9,11)}`;
};
export const unformatCPF = onlyDigits;

export const formatCEP = (v: string) => {
  const s = onlyDigits(v).slice(0, 8);
  if (s.length <= 5) return s;
  return `${s.slice(0,5)}-${s.slice(5)}`;
};
export const unformatCEP = onlyDigits;

export const formatPhoneBR = (v: string) => {
  const s = onlyDigits(v).slice(0, 11); // 10 fixo, 11 celular
  if (s.length <= 2) return `(${s}`;
  if (s.length <= 6) return `(${s.slice(0,2)}) ${s.slice(2)}`;
  if (s.length <= 10) return `(${s.slice(0,2)}) ${s.slice(2,6)}-${s.slice(6)}`;
  return `(${s.slice(0,2)}) ${s.slice(2,7)}-${s.slice(7,11)}`;
};
export const unformatPhoneBR = onlyDigits;

export const toISODate = (v: string) => {
  // vindo do <input type="date"> (YYYY-MM-DD)
  if (!v) return "";
  try { return new Date(v).toISOString(); } catch { return ""; }
};

export const normUF = (v: string) => (v || "").slice(0,2).toUpperCase();
export const normNumero = (v: string) => (v || "").slice(0,10);
