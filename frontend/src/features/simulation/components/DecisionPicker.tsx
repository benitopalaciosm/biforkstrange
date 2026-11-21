import { Button, Heading, Panel, Row, Text } from "@/shared/ui";
import type { DecisionOption } from "../types";

type Props = { options: DecisionOption[]; plan: string[]; onAdd: (k: string) => void; onReset: () => void };

const chico = { width: "auto", minHeight: 44, padding: "0 14px", fontSize: 15 };

export function DecisionPicker({ options, plan, onAdd, onReset }: Props) {
  const label = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  return (
    <Panel>
      <Heading level={3} as="h2">
        Qué haces cada año
      </Heading>
      <Text size="sm">Cada botón agrega un año al plan.</Text>
      <Row>
        {options.map((o) => (
          <Button key={o.key} variant="white" style={chico} title={o.description} onClick={() => onAdd(o.key)}>
            {o.label}
          </Button>
        ))}
        <Button variant="quiet" style={chico} onClick={onReset}>
          Reiniciar
        </Button>
      </Row>
      <Text size="sm">Plan: {plan.map(label).join(" → ") || "(vacío)"}</Text>
    </Panel>
  );
}
