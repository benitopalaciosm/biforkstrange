import { http } from "@/shared/lib/http";
import type { Catalogo, Duda, ParametrosComparar, Partida, Perfil, PerfilLeido, Vista } from "./types";

export const GEMELOS = 500;

export const getCatalogo = () => http<Catalogo>("/api/juego/catalogo");

export const getDudas = (perfil: Perfil) =>
  http<Duda[]>("/api/juego/dudas", { method: "POST", body: JSON.stringify({ perfil }) });

export const getVista = (partida: Partida, parametros: ParametrosComparar = {}) =>
  http<Vista>("/api/juego/partida", {
    method: "POST",
    body: JSON.stringify({ ...partida, gemelos: GEMELOS, parametros }),
  });

export const TEXTO_MAX = 60_000;

/** El prompt que la persona pega en su propio Claude para que le arme su perfil. */
export const getPrompt = () => http<{ prompt: string }>("/api/juego/prompt");

/** Error de la API con su código, para distinguir "Claude no está disponible" (503) de "texto inválido" (422). */
export class ErrorApi extends Error {
  constructor(
    public status: number,
    public detalle: string,
  ) {
    super(detalle);
  }
}

function comoErrorApi(e: unknown): ErrorApi {
  const m = /^(\d{3}): ([\s\S]*)$/.exec(e instanceof Error ? e.message : String(e));
  if (!m) return new ErrorApi(0, e instanceof Error ? e.message : String(e));
  let detalle = m[2];
  try {
    const d = (JSON.parse(m[2]) as { detail?: unknown }).detail;
    if (typeof d === "string") detalle = d;
    else if (Array.isArray(d)) detalle = d.map((x: { msg?: string }) => x.msg ?? "").filter(Boolean).join(" ");
  } catch {
    /* el cuerpo no era JSON: se muestra tal cual */
  }
  return new ErrorApi(Number(m[1]), detalle);
}

/** Lee el documento que armó el Claude de la persona (al tiro). Si es texto libre, Claude lo lee (cerca de medio minuto). */
export async function leerPerfil(texto: string): Promise<PerfilLeido> {
  try {
    return await http<PerfilLeido>("/api/juego/perfil", { method: "POST", body: JSON.stringify({ texto }) });
  } catch (e) {
    throw comoErrorApi(e);
  }
}
