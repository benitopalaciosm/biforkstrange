import { clp } from "@/shared/lib/format";
import { Heading, Meta, Panel, Stack, Text } from "@/shared/ui";
import type { DecisionOption, Step } from "../types";
import { BarList, pctTexto } from "./BarList";

type Props = { steps: Step[]; options: DecisionOption[] };

export function TrajectoryList({ steps, options }: Props) {
  const label = (k: string) => options.find((o) => o.key === k)?.label ?? k;
  const ultimo = steps[steps.length - 1];
  return (
    <Stack gap={20}>
      <Panel>
        <Heading level={3} as="h2">
          Año por año
        </Heading>
        <Text size="sm">Simulamos muchas versiones de ti con el mismo plan. Esto es lo que les pasa.</Text>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((s, i) => {
            const top = s.ocupaciones[0];
            return (
              <li key={i} style={{ padding: 12, borderRadius: 12, background: "var(--papel)", display: "flex", flexDirection: "column", gap: 4 }}>
                <Meta>
                  {s.edad} años · {label(s.decision)}
                </Meta>
                <Text>
                  Sueldo típico: <strong>{clp(s.sueldo_p50)}</strong>
                </Text>
                <Text size="sm">
                  A 8 de cada 10 les queda entre {clp(s.sueldo_p10)} y {clp(s.sueldo_p90)}.
                </Text>
                <Text size="sm">
                  Sin trabajo: {pctTexto(s.prob_desempleo)} · Empezó un empleo nuevo este año: {pctTexto(s.prob_nuevo_empleo)}
                </Text>
                {top && (
                  <Text size="sm">
                    Tipo de trabajo más probable: {top.nombre} ({pctTexto(top.prob)})
                  </Text>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      {ultimo && ultimo.ocupaciones.length > 0 && (
        <Panel>
          <Stack gap={4}>
            <Heading level={3} as="h2">
              Dónde terminas a los {ultimo.edad} años
            </Heading>
            <Text size="sm">Cómo se reparten tus versiones por tipo de trabajo (el actual o el último que tuvieron).</Text>
          </Stack>
          <BarList items={ultimo.ocupaciones.map((o) => ({ key: o.grupo, label: o.nombre, prob: o.prob }))} />
        </Panel>
      )}
    </Stack>
  );
}
