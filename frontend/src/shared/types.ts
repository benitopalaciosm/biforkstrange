/** Contratos de la API (ver backend/app/schemas/juego.py y services/juego_service.py). */

export type Indicador = "dinero" | "carrera" | "bienestar" | "vida_personal";
export type Indicadores = Record<Indicador, number>;
export type Prioridades = Record<Indicador, number>;

export type Perfil = {
  edad: number;
  sexo: "h" | "m";
  edu: "media" | "tecnica" | "universitaria" | "postgrado";
  area: string;
  carrera_id: number | null;
  estado: "empleado" | "buscando";
  tipo_empleador: "grande" | "pyme" | "startup" | "publico" | "extranjero" | null;
  rubro: string;
  nivel: number;
  sueldo: number;
  antiguedad: number;
  ahorro: number;
  pareja: "no" | "pololeo" | "convive" | "casado";
  hijos: number;
  region: "rm" | "otra";
  ingles: boolean;
  usa_ia: boolean;
  remoto: boolean;
  isapre: boolean;
  propietario: boolean;
  riesgo: number;
};

export type Catalogo = {
  rubros: string[];
  areas: string[];
  mundos: { id: string; nombre: string; descripcion: string; ciclo: string; tecnologia: string }[];
  horizonte_anios: number;
  claude: boolean;
  claude_transporte: string | null;
  politica_base: Record<string, Record<string, number>>;
};

type Propension = { decision: string; opcion: string; prob: number };

/** Quién es el gemelo según Claude. El front lo guarda y lo manda en cada petición. */
export type Identidad = { gemelo_md: string; rasgos: string[]; politica: Propension[]; empresa: string; cargo: string };

export type GemeloLeido = {
  perfil: Partial<Record<keyof Perfil, unknown>>;
  empresa: string | null;
  cargo: string | null;
  gemelo_md: string;
  rasgos: string[];
  prioridades: Prioridades;
  riesgo: number;
  politica: Propension[];
};

type Empleador = { tipo: string; nombre: string | null; cargo?: string; detalle: string; fuente: string; url?: string | null };
type Oferta = { tipo: string; empresa: string; cargo: string; seniority: string; sueldo: number; cambio: number | null; detalle: string; fuente: string; url: string | null };

export type Opcion = {
  id: string;
  nombre: string;
  detalle: string;
  efectos: { puntos: Indicadores; p_bueno: number; p_malo: number; p_sin_pega: number };
  arte: string;
  oferta: Oferta | null;
  decision: string | null;
};

export type Suceso = {
  tipo: "evento" | "decision";
  id: string;
  nombre: string;
  resultado: string;
  texto: string;
  tono: "bueno" | "malo" | "neutro";
  silencioso: boolean;
  opcion?: string;
  opcion_nombre?: string;
  origen?: string;
  empleador?: Empleador | null;
  oferta?: Oferta;
};

export type Anio = {
  t: number;
  edad: number;
  estado: string;
  tipo_empleador: string;
  nivel: number;
  sueldo: number;
  sueldo_inicio: number;
  ahorro: number;
  recesion: boolean;
  indicadores: Indicadores;
  indicadores_inicio: Indicadores;
  eventos: Suceso[];
  empleador: Empleador | null;
  tono: "dia" | "noche";
  momento: { tipo: string; valor: number; unidad: string; texto: string; fuente: string } | null;
};

export type ResumenPartida = { felicidad: number; ingreso_acumulado: number; sueldo_final: number; ahorro_final: number; anios_sin_ingreso: number };

export type Turno = {
  terminada: boolean;
  empleador: Empleador | null;
  anios: Anio[];
  horizonte_anios: number;
  estado: { edad: number; estado: string; sueldo: number; indicadores: Indicadores };
  pendiente: { anio: number; edad: number; origen: string; decision: { id: string; nombre: string; pregunta: string }; opciones: Opcion[] } | null;
  mundo: { id: string; nombre: string };
  resumen?: ResumenPartida;
};

export type AnioNarrado = { titulo: string; relato: string; momento: string[] };
export type Caso = { titulo: string; opciones: { id: string; titulo: string; texto: string }[] };
export type Historia = { anio: AnioNarrado | null; caso: Caso | null };
export type Epilogo = { titulo: string; historia: string; cv: string[]; lo_que_te_llevas: string };

type Rango = { p10: number; p50: number; p90: number };
export type Suerte = { n: number; percentil_felicidad: number; percentil_sueldo: number; percentil_ingreso: number; felicidad: Rango; sueldo_final: Rango };

export type Calibracion = { calzan: number; total: number; cohorte: { personas: number } };
