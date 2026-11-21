import { http } from "@/shared/lib/http";
import type { DecisionOption, Ocupacion, PerfilOcupacion, SimulationResult, TwinInput } from "./types";

export const simulationApi = {
  decisions: () => http<DecisionOption[]>("/api/decisions"),
  ocupaciones: () => http<Ocupacion[]>("/api/ocupaciones"),
  perfil: (grupo: number, edad: number) => http<PerfilOcupacion>(`/api/ocupaciones/${grupo}?edad=${edad}`),
  run: (twin: TwinInput, decisiones: string[]) =>
    http<SimulationResult>("/api/simulations", { method: "POST", body: JSON.stringify({ twin, decisiones }) }),
  get: (id: string) => http<SimulationResult>(`/api/simulations/${id}`),
};
