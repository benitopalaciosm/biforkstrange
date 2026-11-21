export const clp = (n: number) => "$" + Math.round(n).toLocaleString("es-CL");

/** Millones de pesos con un decimal: 1.850.000 → "$1,9 M". */
export const clpCorto = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M` : clp(n);

export const pct = (n: number) => `${Math.round(n * 100)}%`;

export const num = (n: number, decimales = 0) => n.toLocaleString("es-CL", { maximumFractionDigits: decimales, minimumFractionDigits: decimales });

/** El juego parte el año siguiente al actual. */
export const anioCalendario = (t: number) => new Date().getFullYear() + 1 + t;
