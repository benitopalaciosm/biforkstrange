export type DecisionOption = { key: string; label: string; description: string };

/** Grupo ocupacional (0..9), como lo entrega GET /api/ocupaciones. */
export type Ocupacion = { grupo: number; nombre: string };

export type OcupacionProb = Ocupacion & { prob: number };

/** Lo que se manda como `twin` en POST /api/simulations. Lo que falta lo completa el backend. */
export type TwinInput = {
  edad: number;
  sueldo: number;
  ocupacion: number;
  desgaste?: number;
  antiguedad?: number;
};

/** Respuesta de GET /api/ocupaciones/{grupo}?edad= */
export type PerfilOcupacion = Ocupacion & {
  edad: number;
  termino_anual: { total: number; cambio_directo: number; cesantia: number; inactividad: number };
  duracion_anios: { p25: number; p50: number; p75: number };
  p_cambia_grupo: number;
  p_cambia_ocupacion: number;
  /** Ordenado de mayor a menor probabilidad. */
  siguiente: OcupacionProb[];
};

export type Step = {
  decision: string;
  edad: number;
  sueldo_p10: number;
  sueldo_p50: number;
  sueldo_p90: number;
  desgaste_p50: number;
  prob_desempleo: number;
  prob_nuevo_empleo: number;
  prob_cambio_grupo: number;
  prob_cambio_ocupacion: number;
  antiguedad_p50: number;
  empleos_p50: number;
  /** Reparto de los gemelos por tipo de trabajo ese año, de mayor a menor. Vacío en corridas antiguas. */
  ocupaciones: OcupacionProb[];
};

export type SimulationResult = { id: string | null; edad_final: number; trayectoria: Step[] };
