/** Formas de la API del juego (`/api/juego/*`). Ver backend/app/sim/motor/partida.py (vista) y gemelos.py (comparar). */

export type Calidad = "dato" | "mixto" | "supuesto";
export type Tono = "bueno" | "malo" | "neutro";
export type Sexo = "h" | "m";
export type Educacion = "media" | "tecnica" | "universitaria" | "postgrado";
export type TipoEmpleador = "grande" | "pyme" | "startup" | "publico" | "extranjero";

export type Perfil = {
  edad: number;
  sexo: Sexo;
  edu: Educacion;
  carrera_id: number; // -1 = sin carrera
  rubro: string;
  tipo_empleador: TipoEmpleador;
  nivel: number;
  sueldo: number;
  riesgo: number;
  // No están en el formulario: los deduce Claude del texto de la persona y se mandan tal cual a la API.
  ocupacion?: number | null;
  antiguedad?: number;
  region?: "rm" | "otra";
  ahorro?: number | null;
  /** 1 si trabaja en inglés (intermedio o más). Mueve remoto y emigrar. */
  ingles?: 0 | 1;
  /** Habilidad y red de contactos (0 a 100), deducidas del CV. Sin dato, el motor usa 50 y 30. */
  skill?: number | null;
  red?: number | null;
};

export type DudaSugerida = { decision: string; nombre?: string; por_que: string };

/** Respuesta de `POST /api/juego/perfil`: el perfil que Claude llenó desde un texto. */
export type PerfilLeido = {
  perfil: Perfil;
  /** Campos que el texto no decía y quedaron con un valor por defecto. */
  supuestos: { campo: string; nombre: string }[];
  /** Frases cortas: qué dedujo Claude y de dónde. */
  inferido: string[];
  /** Valores del documento que no se pudieron usar. */
  avisos: string[];
  /** La duda que el documento trae, si es una posible para este perfil. */
  duda: string | null;
  /** Hasta 3 dudas que le calzan a esta persona según su CV, con el porqué. Solo si Claude leyó un texto o PDF. */
  dudas_sugeridas?: DudaSugerida[];
  /** Su empleador actual, si está en la nómina del SII. */
  empresa?: { nombre: string; tamano: string; rubro: string; trabajadores: number; fuente: string } | null;
  /** Lo que su gemelo sabe de ella, en una línea. */
  retrato?: string | null;
  /** "documento" si venía en el formato del prompt; "api" o "comando" si Claude leyó un texto libre. */
  via: string;
};

export type Carrera = { carrera_id: number; carrera: string; tipo_institucion: string; area: string };

export type Catalogo = {
  rubros: string[];
  tipos_empleador: TipoEmpleador[];
  niveles: { nivel: number; nombre: string }[];
  educacion: Educacion[];
  ocupaciones: { grupo: number; nombre: string }[];
  carreras: Carrera[];
  /** Sueldo líquido por estudios y banda de edad (ESI 2025): la referencia del sueldo. */
  sueldos_ref: { educacion: Educacion; banda: string; p25: number; p50: number; p75: number }[];
};

export type Duda = { decision: string; nombre: string; pregunta: string; categoria: string; calidad: Calidad };

export type Eleccion = { decision?: string | null; opcion: string; parametros?: Record<string, string | number> };

/** Lo que el cliente guarda y manda completo en cada llamada. */
export type Partida = { perfil: Perfil; semilla: number; duda: string | null; elecciones: Eleccion[] };

export type Estado = {
  edad: number;
  estado: string;
  sueldo: number;
  sueldo_ref: number;
  nivel: number;
  cargo: string;
  tipo_empleador: string;
  rubro: string;
  edu: string;
  antiguedad: number;
  ahorro: number;
};

/** La historia de la carta: qué empresa, quién te escribe. Solo texto; los números vienen aparte. */
export type Narrativa = { situacion: string } | null;

export type DecisionTomada = {
  decision: string;
  nombre: string;
  pregunta: string;
  narrativa?: Narrativa;
  origen: string;
  opcion: string;
  opcion_nombre: string;
  resultado: string;
  texto: string;
  tono: Tono;
  prob: number;
};

export type Evento = {
  evento: string;
  nombre: string;
  resultado: string;
  texto: string;
  tono: Tono;
  /** Probabilidad de que pase el evento y salga este resultado. */
  prob: number;
  prob_evento?: number;
  /** Gatillado por otra regla: no tiene probabilidad propia que mostrar. */
  directo?: boolean;
  rutina?: boolean;
};

export type Anio = {
  /** Número de ronda, no de año: para el año usa la edad. */
  anio: number;
  edad: number;
  recesion: boolean;
  decisiones: DecisionTomada[];
  eventos: Evento[];
  /** Solo en los años cerrados. */
  fin?: Estado;
};

export type Rango = { p10: number; p50: number; p90: number };

/** Frente a la opción base, con la misma suerte: proporciones que suman 1 (null en la base). "Igual" = a menos de 0,5%. */
export type ContraBase = {
  gana_mas_que_base: number | null;
  igual_que_base: number | null;
  gana_menos_que_base: number | null;
  /** Mediana de la diferencia con la base, en pesos al mes. */
  diferencia_tipica: number | null;
  diferencia_si_cambia?: number | null;
};

export type PorResultado = ContraBase & {
  resultado: string;
  texto: string;
  tono: Tono;
  gemelos: number;
  prob: number;
};

export type OpcionComparada = ContraBase & {
  opcion: string;
  nombre: string;
  detalle: string;
  calidad: Calidad;
  es_base: boolean;
  sueldo: Rango;
  ingreso_total: Rango;
  paso_por_cesantia: number;
  meses_sin_trabajo: number;
  sin_trabajo_al_final: number;
  cargo_mas_probable: string;
  cargos: { cargo: string; prob: number }[];
  /** Lo que se supuso dentro de la opción (rubro, región…). */
  parametros?: Record<string, string | number>;
  por_resultado: PorResultado[];
  trayectoria: { edad: number; p10: number; p50: number; p90: number; sin_trabajo: number }[];
};

export type Comparacion = {
  decision: string;
  nombre: string;
  pregunta: string;
  gemelos: number;
  anios: number;
  base: string;
  opciones: OpcionComparada[];
  /** En cada mundo (el índice), con qué opción terminas ganando más; null si dos quedan a menos de 0,5%. */
  ganador_por_mundo?: (string | null)[];
};

export type Suceso = { tipo: "decision" | "evento"; nombre: string; opcion?: string; texto: string; tono: Tono };

export type AnioMundo = {
  anio: number;
  edad: number;
  recesion: boolean;
  sucesos: Suceso[];
  fin: { sueldo: number; sueldo_ref: number; cargo: string; estado: string; tipo_empleador: string } | null;
};

/** Respuesta de `POST /api/juego/mundo`: un mundo, con su historia por opción. */
export type MundoDetalle = {
  mundo: number;
  decision: string;
  ganador: string | null;
  opciones: { opcion: string; nombre: string; sueldo_final: number; estado_final: string; anios: AnioMundo[] }[];
};

export type EleccionInterna = {
  variable: string;
  pregunta: string;
  alternativas: { valor: string | number; nombre: string; prob?: number }[];
};

/** Un empleador u oferta real del tipo al que lleva la opción. Es referencia: no entra a la simulación
 *  y no es la empresa de la historia (esa es ficticia, para no inventar hechos sobre empresas reales). */
export type EjemploReal = {
  tipo: string;
  nombre: string;
  detalle: string;
  fuente: string;
  cargo?: string;
  url?: string;
};

export type OpcionPendiente = {
  opcion: string;
  nombre: string;
  detalle: string;
  calidad: Calidad;
  elecciones_internas: EleccionInterna[];
  ejemplo_real?: EjemploReal | null;
};

/** Por qué te tocó esta decisión. */
export type PorQue =
  | { tipo: "sorteo"; prob: number; posibles: number }
  | { tipo: "obligada" }
  | { tipo: "consecuencia" }
  | { tipo: "elegida" };

export type Pendiente = {
  por_que?: PorQue;
  decision: string;
  nombre: string;
  pregunta: string;
  narrativa?: Narrativa;
  categoria: string;
  calidad: Calidad;
  creencia_vs_dato: string | null;
  evidencia: { fuente: string; cifra: string; uso: string }[];
  opciones: OpcionPendiente[];
  /** null cuando la decisión tiene demasiadas opciones para simular gemelos. */
  comparacion: Comparacion | null;
};

export type Cierre = {
  sueldo_final: number;
  estado: Estado;
  anios_sin_trabajo: number;
  mejor_que_gemelos?: number;
  primera_decision: { decision: string; pregunta: string; elegida: string; comparacion: Comparacion } | null;
};

export type Vista = {
  terminada: boolean;
  /** Años de edad transcurridos (tope `anios`). Una ronda puede ocupar varios (un doctorado, 5). */
  anio: number;
  edad_final: number;
  anios: number;
  estado: Estado;
  historia: Anio[];
  anio_en_curso: Anio | null;
  pendiente: Pendiente | null;
  cierre: Cierre | null;
};

/** Lo que se elige dentro de cada opción para comparar: {opción: {variable: valor}}. */
export type ParametrosComparar = Record<string, Record<string, string | number>>;
