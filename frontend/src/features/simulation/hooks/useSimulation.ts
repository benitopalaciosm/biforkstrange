import { useEffect, useState } from "react";
import { simulationApi } from "../api";
import type { DecisionOption, Ocupacion, SimulationResult, TwinInput } from "../types";

export const EDAD_MIN = 18;
export const EDAD_MAX = 50;

const TWIN_INICIAL: TwinInput = { edad: 25, sueldo: 900_000, ocupacion: 2 };

export function twinValido(t: TwinInput) {
  return Number.isInteger(t.edad) && t.edad >= EDAD_MIN && t.edad <= EDAD_MAX && Number.isFinite(t.sueldo) && t.sueldo > 0;
}

export function useSimulation() {
  const [options, setOptions] = useState<DecisionOption[]>([]);
  const [ocupaciones, setOcupaciones] = useState<Ocupacion[]>([]);
  const [twin, setTwin] = useState<TwinInput>(TWIN_INICIAL);
  const [plan, setPlan] = useState<string[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    simulationApi.decisions().then(setOptions).catch((e) => setError(String(e)));
    simulationApi.ocupaciones().then(setOcupaciones).catch((e) => setError(String(e)));
  }, []);

  async function run() {
    setLoading(true);
    setError("");
    try {
      setResult(await simulationApi.run(twin, plan));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    options, ocupaciones, twin, plan, result, loading, error, run,
    twinOk: twinValido(twin),
    setTwin: (cambio: Partial<TwinInput>) => setTwin((t) => ({ ...t, ...cambio })),
    add: (key: string) => setPlan((p) => [...p, key]),
    reset: () => { setPlan([]); setResult(null); },
  };
}
