/** Pesos chilenos cortos: 1.850.000 → "$1,9 M"; bajo un millón, el número completo. */
export const clpCorto = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `$${(n / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M` : "$" + Math.round(n).toLocaleString("es-CL");
