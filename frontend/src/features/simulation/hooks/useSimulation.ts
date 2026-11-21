import { useEffect, useState } from "react";
import { simulationApi } from "../api";
import type { DecisionOption, SimulationResult } from "../types";

export function useSimulation() {
  const [options, setOptions] = useState<DecisionOption[]>([]);
  const [plan, setPlan] = useState<string[]>([]);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    simulationApi.decisions().then(setOptions).catch((e) => setError(String(e)));
  }, []);

  async function run() {
    setLoading(true);
    setError("");
    try {
      setResult(await simulationApi.run(plan));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return {
    options, plan, result, loading, error, run,
    add: (key: string) => setPlan((p) => [...p, key]),
    reset: () => { setPlan([]); setResult(null); },
  };
}
