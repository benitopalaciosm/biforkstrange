export type DecisionOption = { key: string; label: string; description: string };

export type Step = {
  decision: string;
  edad: number;
  sueldo_p10: number;
  sueldo_p50: number;
  sueldo_p90: number;
  desgaste_p50: number;
  prob_desempleo: number;
};

export type SimulationResult = { id: string | null; edad_final: number; trayectoria: Step[] };
