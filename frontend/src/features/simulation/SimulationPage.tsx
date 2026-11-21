import { Button, Stack, Text } from "@/shared/ui";
import { DecisionPicker } from "./components/DecisionPicker";
import { PerfilPanel } from "./components/PerfilPanel";
import { TrajectoryList } from "./components/TrajectoryList";
import { TwinForm } from "./components/TwinForm";
import { EDAD_MAX, EDAD_MIN, useSimulation } from "./hooks/useSimulation";

export function SimulationPage() {
  const sim = useSimulation();
  const edad = sim.twin.edad;
  const edadOk = Number.isInteger(edad) && edad >= EDAD_MIN && edad <= EDAD_MAX;
  return (
    <Stack className="vd" gap={20}>
      <TwinForm twin={sim.twin} ocupaciones={sim.ocupaciones} onChange={sim.setTwin} />
      <PerfilPanel grupo={sim.twin.ocupacion} edad={edadOk ? edad : null} />
      <DecisionPicker options={sim.options} plan={sim.plan} onAdd={sim.add} onReset={sim.reset} />
      <Button disabled={!sim.plan.length || !sim.twinOk || sim.loading} onClick={sim.run}>
        {sim.loading ? "Simulando…" : "Simular"}
      </Button>
      {sim.error && (
        <Text size="sm" style={{ color: "var(--vida)", whiteSpace: "pre-wrap" }}>
          {sim.error}
        </Text>
      )}
      {sim.result && <TrajectoryList steps={sim.result.trayectoria} options={sim.options} />}
    </Stack>
  );
}
