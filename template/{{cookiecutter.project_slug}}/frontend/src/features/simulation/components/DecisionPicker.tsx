import type { DecisionOption } from "../types";

type Props = { options: DecisionOption[]; plan: string[]; onAdd: (k: string) => void; onReset: () => void };

export function DecisionPicker({ options, plan, onAdd, onReset }: Props) {
  const label = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  return (
    <section>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((o) => (
          <button key={o.key} title={o.description} onClick={() => onAdd(o.key)}>{o.label}</button>
        ))}
        <button onClick={onReset}>Reiniciar</button>
      </div>
      <p>Plan: {plan.map(label).join(" → ") || "(vacío)"}</p>
    </section>
  );
}
