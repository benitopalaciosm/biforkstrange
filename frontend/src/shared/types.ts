/** Contratos de la API (ver backend/app/schemas/juego.py y services/juego_service.py). */

export type Indicador = "dinero" | "carrera" | "bienestar" | "vida_personal";
export type Indicadores = Record<Indicador, number>;
export type Prioridades = Record<Indicador, number>;
export type Calidad = "dato" | "mixto" | "supuesto";

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

export type Fuente = { id: string; cita: string; url: string | null };
export type Mundo = { id: string; nombre: string; descripcion: string; ciclo: string; tecnologia: string };

export type Catalogo = {
  rubros: string[];
  areas: string[];
  mundos: Mundo[];
  horizonte_anios: number;
  claude: boolean;
  claude_transporte: string | null;
  politica_base: Record<string, Record<string, number>>;
};

export type Propension = { decision: string; opcion: string; prob: number };

/** Quién es el gemelo según Claude. El front lo guarda y lo manda en cada petición. */
export type Identidad = { gemelo_md: string; rasgos: string[]; politica: Propension[]; empresa: string; cargo: string };
export const SIN_IDENTIDAD: Identidad = { gemelo_md: "", rasgos: [], politica: [], empresa: "", cargo: "" };

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

export type Empleador = { tipo: string; nombre: string | null; cargo?: string; detalle: string; fuente: string; url?: string | null };

export type Efectos = { puntos: Indicadores; p_bueno: number; p_malo: number; p_sin_pega: number };
export type ResultadoPosible = { id: string; texto: string; tono: "bueno" | "malo" | "neutro"; prob: number };
export type Opcion = {
  id: string;
  nombre: string;
  detalle: string;
  calidad: Calidad;
  fuentes: Fuente[];
  resultados: ResultadoPosible[];
  efectos: Efectos;
  arte: string;
  oferta: Oferta | null;
  decision: string | null;
};

export type Oferta = { tipo: string; empresa: string; cargo: string; seniority: string; sueldo: number; cambio: number | null; detalle: string; fuente: string; url: string | null };

export type Camino = {
  id: string;
  titulo: string;
  premisa: string;
  decision: string;
  creencia_vs_dato: string | null;
  a: Opcion;
  b: Opcion;
  contexto: Empleador | null;
  narrado: { titulo: string; texto: string } | null;
};

export type Caminos = { titulo: string; total: number; por_claude: boolean; caminos: Camino[]; indicadores: Indicadores; edad: number };

export type Gemelo = { perfil: Perfil; prioridades: Prioridades; estado: { indicadores: Indicadores; edad: number }; mundos: Mundo[]; horizonte_anios: number };

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

export type Momento = { tipo: string; valor: number; unidad: string; texto: string; fuente: string };

export type Anio = {
  t: number;
  edad: number;
  estado: string;
  tipo_empleador: string;
  rubro: string;
  nivel: number;
  sueldo: number;
  sueldo_inicio: number;
  ahorro: number;
  recesion: boolean;
  indicadores: Indicadores;
  indicadores_inicio: Indicadores;
  felicidad: number;
  eventos: Suceso[];
  empleador: Empleador | null;
  tono: "dia" | "noche";
  escena: "viaje" | "emigrar" | "oficina" | null;
  momento: Momento | null;
  horas: number;
  fines_con_tu_gente: number;
  fines_perdidos: number;
  te_perdiste: string | null;
};

export type Pendiente = {
  anio: number;
  edad: number;
  origen: "bifurcacion" | "forzada" | "carta" | "consecuencia";
  decision: { id: string; nombre: string; pregunta: string; categoria: string; calidad: Calidad; creencia_vs_dato: string | null; evidencia: { cifra: string; fuente: Fuente }[] };
  opciones: Opcion[];
  eventos_previos: Suceso[];
  recesion: boolean;
  contexto: Empleador | null;
};

export type ResumenPartida = {
  felicidad: number;
  indicadores: Indicadores;
  ingreso_acumulado: number;
  sueldo_final: number;
  ahorro_final: number;
  anios_sin_ingreso: number;
  recesiones: number;
};

export type Turno = {
  terminada: boolean;
  empleador: Empleador | null;
  anios: Anio[];
  horizonte_anios: number;
  estado: { edad: number; estado: string; indicadores: Indicadores; sueldo: number };
  pendiente: Pendiente | null;
  mundo: { id: string; nombre: string };
  resumen?: ResumenPartida;
};

export type AnioNarrado = { titulo: string; relato: string; perdido: string[]; mensajes: { de: string; mensaje: string; hora: string }[]; momento: string[] };
export type Caso = { titulo: string; opciones: { id: string; titulo: string; texto: string }[] };
export type Historia = { anio: AnioNarrado | null; caso: Caso | null };
export type Epilogo = { titulo: string; historia: string; cv: string[]; lo_que_te_llevas: string };

export type Rango = { p10: number; p50: number; p90: number };
export type ResumenCamino = { n: number; felicidad: Rango; indicadores_rango: Record<Indicador, Rango>; prob_sin_pega: number };
export type Celda = { mundo: Mundo; a: ResumenCamino; b: ResumenCamino; prob_gana_a: number; margen: number; gana: "a" | "b" | "parejo" };
export type Comparacion = {
  id: string;
  bifurcacion: { id: string; a: { id: string; nombre: string }; b: { id: string; nombre: string } };
  politica_propia: boolean;
  n: number;
  mundos: Celda[];
  partidas: { mundo: string; camino: "a" | "b"; felicidad: number; percentil: number }[];
  veredicto: { tipo: string; camino: "a" | "b" | null; frase: string };
  aprendizajes: { tipo: string; frase: string }[];
};

export type Calibracion = { calzan: number; total: number; cohorte: { personas: number }; indicadores: { indicador: string; simulado: number; objetivo: number; calza: boolean; fuente: string }[] };

export type PartidaJugada = { bifurcacion: string; mundo: string; semilla: number; elecciones: string[]; camino: "a" | "b" };

export type Suerte = {
  n: number;
  percentil_felicidad: number;
  percentil_sueldo: number;
  percentil_ingreso: number;
  felicidad: Rango;
  sueldo_final: Rango;
  prob_sin_pega: number;
};
