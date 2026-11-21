import { http } from "@/shared/lib/http";
import type { DecisionOption, SimulationResult } from "./types";

export const simulationApi = {
  decisions: () => http<DecisionOption[]>("/api/decisions"),
  run: (decisiones: string[]) =>
    http<SimulationResult>("/api/simulations", { method: "POST", body: JSON.stringify({ decisiones }) }),
  get: (id: string) => http<SimulationResult>(`/api/simulations/${id}`),
};
