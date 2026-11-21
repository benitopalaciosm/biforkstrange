import type { Anio, Indicador, Perfil } from "@/shared/types";

/** Contadores de la carrera, calculados de lo que el motor ya vivió. */
export type Contadores = { empresas: number; cambios: number; ascensos: number; sueldoMax: number; ahorro: number; sinPega: number; clubes: { anio: number; nombre: string; cargo: string }[] };

const ES_ASCENSO = (id: string, res: string) => (id === "ascenso" && res === "sube") || (id === "jefatura" && (res === "bien" || res === "mal"));

export function contadores(anios: Anio[], perfil: Perfil, empresaInicial: string, ahorroInicial: number): Contadores {
  const clubes: Contadores["clubes"] = [];
  let actual = empresaInicial || "Tu pega";
  clubes.push({ anio: -1, nombre: actual, cargo: "" });
  let cambios = 0;
  let ascensos = 0;
  for (const a of anios) {
    for (const x of a.eventos) {
      if (ES_ASCENSO(x.id, x.resultado)) ascensos++;
      const nuevo = x.oferta?.empresa ?? x.empleador?.nombre ?? null;
      if (nuevo && nuevo !== actual && (x.oferta || x.id === "tipo_de_empleador" || x.id === "cesantia" || x.id === "separacion_empleo")) {
        cambios++;
        actual = nuevo;
        clubes.push({ anio: a.t, nombre: nuevo, cargo: x.oferta?.cargo ?? "" });
      }
    }
  }
  return {
    empresas: new Set(clubes.map((c) => c.nombre)).size,
    cambios,
    ascensos,
    sueldoMax: Math.max(perfil.estado === "empleado" ? perfil.sueldo : 0, ...anios.map((a) => a.sueldo)),
    ahorro: anios.length ? anios[anios.length - 1].ahorro : ahorroInicial,
    sinPega: anios.filter((a) => a.estado === "buscando" || a.estado === "inactivo").length,
    clubes,
  };
}

const PROMEDIO = (anios: Anio[], k: Indicador) => Math.round(anios.reduce((s, a) => s + a.indicadores[k], 0) / Math.max(1, anios.length));

export function atributos(anios: Anio[]) {
  return { DIN: PROMEDIO(anios, "dinero"), CAR: PROMEDIO(anios, "carrera"), BIE: PROMEDIO(anios, "bienestar"), VID: PROMEDIO(anios, "vida_personal") };
}

/** El título de tu carrera, como el veredicto de una carta de jugador. Primera regla que calza. */
export function veredicto(anios: Anio[], c: Contadores, sueldoInicial: number, felicidad: number): { titulo: string; por: string } {
  const hechos = new Set(anios.flatMap((a) => a.eventos.map((x) => `${x.id}/${x.resultado}`)));
  const ultimo = anios[anios.length - 1];
  if (hechos.has("venta_startup/venta_startup")) return { titulo: "Acciones que valieron oro", por: "Te fuiste a una startup y la compraron." };
  if (hechos.has("emigrar/consigue")) return { titulo: "Legionario", por: "Te fuiste a trabajar afuera." };
  if (ultimo?.estado === "fundador") return { titulo: "Patrón de fundo", por: "Terminas con tu propia empresa." };
  if (c.cambios >= 4) return { titulo: "Trotamundos", por: `${c.empresas} empresas en ${anios.length} años.` };
  if (ultimo && ultimo.nivel >= 3) return { titulo: "Jefatura", por: "Llegaste a liderar un equipo." };
  if (c.cambios === 0 && c.ascensos >= 1) return { titulo: "Fiel a la camiseta", por: "Creciste sin cambiarte de empresa." };
  if (c.sinPega >= 2) return { titulo: "Resiliente", por: `${c.sinPega} años sin pega y seguiste.` };
  if (sueldoInicial > 0 && c.sueldoMax >= 2 * sueldoInicial) return { titulo: "Escalada", por: "Duplicaste tu sueldo." };
  if (felicidad >= 72) return { titulo: "Vida en equilibrio", por: "Tu vida quedó cerca de lo que te importa." };
  if (c.cambios === 0) return { titulo: "Firme en tu puesto", por: "Diez años en la misma pega." };
  return { titulo: "Oficio y paciencia", por: `${c.empresas} empresas, ${c.ascensos} ascensos.` };
}

/** Logros, como los títulos de una carrera. */
export function logros(anios: Anio[], c: Contadores, sueldoInicial: number): string[] {
  const hechos = new Set(anios.flatMap((a) => a.eventos.map((x) => `${x.id}/${x.resultado}`)));
  const tipos = new Set(anios.flatMap((a) => a.eventos.map((x) => x.oferta?.tipo).filter(Boolean)));
  const out: string[] = [];
  if (c.ascensos) out.push(c.ascensos === 1 ? "Primer ascenso" : `${c.ascensos} ascensos`);
  if (hechos.has("jefatura/bien") || hechos.has("jefatura/mal")) out.push("Jefatura");
  if (tipos.has("startup")) out.push("Startup");
  if (tipos.has("publico")) out.push("Funcionario público");
  if (tipos.has("extranjero")) out.push("Sueldo en dólares");
  if (hechos.has("magister/termina")) out.push("Magíster");
  if (hechos.has("bootcamp/colocado")) out.push("Reconversión");
  if (hechos.has("pedir_aumento/si")) out.push("Aumento negociado");
  if (hechos.has("sabatico/vuelve_bien") || hechos.has("sabatico/cuesta_volver")) out.push("Año sabático");
  if (sueldoInicial > 0 && c.sueldoMax >= 1.5 * sueldoInicial) out.push("+50% de sueldo");
  if (c.sueldoMax >= 3_000_000) out.push("Club de los 3 millones");
  if (c.sinPega === 0) out.push("Nunca sin pega");
  return out;
}
