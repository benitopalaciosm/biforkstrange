export const clp = (n: number) =>
  n.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export const pct = (n: number) => `${(n * 100).toFixed(0)}%`;
