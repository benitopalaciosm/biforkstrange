import type { DecisionArtKind, DecisionTag, IndicatorValues } from "@/shared/ui";
import type { Anio, Identidad, Indicadores, Opcion, Suceso } from "@/shared/types";

/** El juego parte el año siguiente al actual. */
export const ANIO_0 = new Date().getFullYear() + 1;
export const anioDe = (t: number) => ANIO_0 + t;

/** Las barras del backend (vida_personal) con los nombres del kit (vida). */
export const aKit = (i: Indicadores): IndicatorValues => ({ dinero: i.dinero, carrera: i.carrera, bienestar: i.bienestar, vida: i.vida_personal });

const NOMBRE: Record<keyof Indicadores, string> = { dinero: "Dinero", carrera: "Carrera", bienestar: "Bienestar", vida_personal: "Vida personal" };

const ARTE: Record<string, DecisionArtKind> = {
  viaje: "viaje", edificio: "consultora", estudiar: "magister", invertir: "invertir", cohete: "cohete",
  puerta: "puerta", casa: "casa", gente: "gente", noche: "noche", quedarse: "quedarse",
};
export const arte = (k: string): DecisionArtKind => ARTE[k] ?? "consultora";

/**
 * Etiquetas de una carta, calculadas por el motor: qué barras mueve y cuánto se arriesga.
 * «Para ti» cuando el gemelo elige esa opción bastante más que la gente en general.
 */
export function etiquetas(o: Opcion, decision: string, identidad: Identidad, base: Record<string, Record<string, number>>): DecisionTag[] {
  const tags: DecisionTag[] = [];
  const propia = identidad.politica.find((p) => p.decision === decision && p.opcion === o.id)?.prob;
  const general = base[decision]?.[o.id];
  if (propia !== undefined && general !== undefined && propia - general >= 0.1) tags.push({ label: "Para ti", tone: "accent" });
  const e = o.efectos;
  Object.entries(e.puntos)
    .filter(([, v]) => Math.abs(v) >= 3)
    .sort((x, y) => Math.abs(y[1]) - Math.abs(x[1]))
    .slice(0, 3)
    .forEach(([k, v]) => tags.push({ label: `${v > 0 ? "+" : "−"} ${NOMBRE[k as keyof Indicadores]}`, tone: v < 0 ? "minus" : "default" }));
  if (e.p_bueno >= 0.08 && e.p_malo >= 0.15) tags.push({ label: `Sale bien ${Math.max(1, Math.round(e.p_bueno * 10))} de 10`, tone: "sol" });
  else if (e.p_sin_pega >= 0.15 && e.p_sin_pega < 0.99) tags.push({ label: `Sin pega ${Math.round(e.p_sin_pega * 10)} de 10`, tone: "sol" });
  return tags;
}

/** Frase de plantilla de un año, para cuando Claude no está o todavía no llega. */
export function plantilla(a: Anio): { titulo: string; relato: string } {
  const visibles = a.eventos.filter((x) => !x.silencioso && x.id !== "recesion" && x.id !== "tipo_de_empleador");
  const frase = (x: Suceso) => {
    const minus = `${x.texto.charAt(0).toLowerCase()}${x.texto.slice(1)}`;
    const base =
      x.origen === "gemelo" && x.opcion_nombre
        ? `Tu gemelo eligió por ti (${x.opcion_nombre.toLowerCase()}): ${minus}`
        : x.tipo === "decision" && x.origen !== "consecuencia" && x.opcion_nombre
          ? `${x.opcion_nombre}: ${minus}`
          : x.texto;
    return x.empleador?.nombre && x.tono !== "malo" ? base.replace(/\.$/, ` (${x.empleador.nombre}).`) : base;
  };
  const fuerte = visibles.find((x) => x.tono === "malo") ?? visibles.find((x) => x.tono === "bueno") ?? visibles[0];
  return {
    titulo: fuerte ? fuerte.texto : a.recesion ? "Un año de recesión." : "Un año tranquilo.",
    relato: visibles.length ? visibles.map(frase).join(" ") : "Seguiste en lo tuyo.",
  };
}

export const ESTADO: Record<string, string> = { empleado: "Con trabajo", buscando: "Sin pega", fundador: "Tu empresa", inactivo: "Sin trabajar", independiente: "Por tu cuenta" };

export function donde(a: { estado: string; tipo_empleador: string; rubro: string; empleador: { nombre: string | null } | null }) {
  if (a.estado !== "empleado") return ESTADO[a.estado] ?? a.estado;
  const tipo: Record<string, string> = { grande: "Empresa grande", pyme: "Pyme", startup: "Startup", publico: "El Estado", extranjero: "Remoto" };
  return a.empleador?.nombre ?? tipo[a.tipo_empleador] ?? "Con trabajo";
}

/** Título de la carta de un camino cuando Claude no lo escribió. */
export const TITULO_CAMINO: Record<string, (empresa?: string | null) => string> = {
  cambiarme: () => "Aceptar la oferta de otra empresa",
  startup: (e) => `Irte a ${e ?? "una startup"} con acciones`,
  emprender: () => "Renunciar para emprender",
  magister: () => "Hacer un magíster de noche",
  sabatico: () => "Tomarte un año sabático",
  emigrar: () => "Irte a trabajar a Estados Unidos",
  renunciar: () => "Renunciar sin tener otra pega",
  remoto: () => "Postular a un remoto en dólares",
  bootcamp: () => "Reconvertirte con un bootcamp",
  horas: () => "Sumarte a las 55 horas del equipo",
  cesante: () => "Tomar lo primero que salga",
};

/** Cambia los nombres de las opciones («Irte», «Quedarte») por «el camino A» / «el camino B» en una frase del backend. */
export function conLetras(frase: string, nombres: { a: string; b: string }): string {
  const t = frase.split(`«${nombres.a}»`).join("el camino A").split(`«${nombres.b}»`).join("el camino B");
  return t.charAt(0).toUpperCase() + t.slice(1);
}
