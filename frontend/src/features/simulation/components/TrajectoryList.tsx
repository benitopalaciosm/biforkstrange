import { clp, pct } from "@/shared/lib/format";
import type { Step } from "../types";

export function TrajectoryList({ steps }: { steps: Step[] }) {
  return (
    <ol>
      {steps.map((s, i) => (
        <li key={i}>
          {s.edad} años, {s.decision}: {clp(s.sueldo_p50)} (p10 {clp(s.sueldo_p10)}, p90 {clp(s.sueldo_p90)}),
          desempleo {pct(s.prob_desempleo)}
        </li>
      ))}
    </ol>
  );
}
