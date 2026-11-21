import { DecisionPicker } from "./components/DecisionPicker";
import { TrajectoryList } from "./components/TrajectoryList";
import { useSimulation } from "./hooks/useSimulation";

export function SimulationPage() {
  const sim = useSimulation();
  return (
    <>
      <DecisionPicker options={sim.options} plan={sim.plan} onAdd={sim.add} onReset={sim.reset} />
      <button disabled={!sim.plan.length || sim.loading} onClick={sim.run}>
        {sim.loading ? "Simulando…" : "Simular"}
      </button>
      {sim.error && <pre style={{ color: "crimson" }}>{sim.error}</pre>}
      {sim.result && <TrajectoryList steps={sim.result.trayectoria} />}
    </>
  );
}
