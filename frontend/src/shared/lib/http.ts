import { env } from "@/shared/config/env";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Mensaje legible de un error de FastAPI (`detail` puede ser texto o una lista de validación). */
function detalle(texto: string): string {
  try {
    const d = JSON.parse(texto).detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) return d.map((x) => String(x.msg ?? "").replace(/^Value error, /, "")).join(" ");
  } catch {
    /* no era JSON */
  }
  return texto;
}

export async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const esFormulario = init?.body instanceof FormData;
  const res = await fetch(`${env.apiUrl}${path}`, {
    ...init,
    headers: esFormulario ? init?.headers : { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) throw new HttpError(res.status, detalle(await res.text()));
  return res.json() as Promise<T>;
}

export const post = <T>(path: string, body: unknown) => http<T>(path, { method: "POST", body: JSON.stringify(body) });
