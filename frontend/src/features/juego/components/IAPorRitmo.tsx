import { Meta, Stack, Text } from "@/shared/ui";
import { plata } from "../textos";
import type { CierreIA, IAPorRitmo, OpcionComparada, Ritmo } from "../types";
import { Info } from "./graficos";

export const NOMBRE_RITMO: Record<Ritmo, string> = { lento: "IA lenta", medio: "IA a ritmo medio", rapido: "IA rápida" };
const ORDEN: Ritmo[] = ["lento", "medio", "rapido"];

/** En cuántos mundos gana cada opción, separado por el ritmo de la IA de cada mundo. Con la incertidumbre de IA
 *  apagada no hay ritmos y no se muestra. */
export function IAPorRitmoTabla({ ia, comparadas, colores }: { ia: IAPorRitmo; comparadas: OpcionComparada[]; colores: Record<string, string> }) {
  const ritmos = ORDEN.filter((r) => ia.ritmos[r]);
  if (ritmos.length === 0) return null;
  const robustas = comparadas.filter((o) => ia.robustas.includes(o.opcion));
  const columnas = { gridTemplateColumns: `minmax(0, 1.6fr) repeat(${comparadas.length}, minmax(0, 1fr))` };
  return (
    <Stack gap={8} className="jg-ia-ritmos">
      <Meta>Según qué tan rápido llegue la IA</Meta>
      <div className="jg-ia-tabla" role="table" aria-label="Mundos que gana cada opción según el ritmo de la IA">
        <div role="row" className="jg-ia-fila jg-ia-cabeza" style={columnas}>
          <span role="columnheader" />
          {comparadas.map((o) => (
            <span role="columnheader" key={o.opcion} style={{ color: colores[o.opcion] }}>{o.nombre}</span>
          ))}
        </div>
        {ritmos.map((r) => {
          const fila = ia.ritmos[r]!;
          const tope = Math.max(...Object.values(fila.gana));
          return (
            <div role="row" className="jg-ia-fila" key={r} style={columnas}>
              <span role="rowheader">
                {NOMBRE_RITMO[r]} <i className="jg-chico">· {fila.mundos} mundos</i>
              </span>
              {comparadas.map((o) => (
                <span role="cell" key={o.opcion} data-fuerte={fila.gana[o.opcion] === tope && tope > 0}>
                  {fila.gana[o.opcion] ?? 0}
                </span>
              ))}
            </div>
          );
        })}
      </div>
      <Text size="sm">
        {robustas.length === 1
          ? `«${robustas[0].nombre}» gana en más mundos con cualquier ritmo de la IA: es la apuesta robusta.`
          : robustas.length > 1
            ? "Más de una opción gana con cualquier ritmo de la IA."
            : "Qué opción gana depende de qué tan rápido llegue la IA: no hay una que gane en los tres."}
      </Text>
      <Info pregunta="¿De dónde salen los ritmos?">
        Cada mundo trae un ritmo de la IA, igual para todas tus opciones. Salen con las probabilidades que economistas y
        superforecasters dieron en 2026 a cada escenario al 2030: 42% lento, 45% medio y 13% rápido (Forecasting Research
        Institute). Es un pronóstico de expertos, no una frecuencia como la de la recesión. Con pocos mundos de IA rápida,
        su conteo es ruidoso.
      </Info>
    </Stack>
  );
}

/** El cierre: el ritmo de la IA de tu mundo, cómo te habría ido con los otros y quién dice qué del futuro. */
export function IACierre({ ia, elegida, nombreElegida }: { ia: CierreIA; elegida?: string; nombreElegida?: string }) {
  const tuyo = ia.ritmos[ia.ritmo];
  const ritmos = ia.por_ritmo ? ORDEN.filter((r) => ia.por_ritmo!.ritmos[r]) : [];
  return (
    <Stack as="section" gap={10} className="jg-ia-cierre">
      <Meta>La IA en tu mundo</Meta>
      <Text>
        Viviste un mundo de <b>{NOMBRE_RITMO[ia.ritmo]}</b>. {tuyo.que_es}
      </Text>
      {elegida && ritmos.length > 1 && (
        <div className="jg-escenarios" role="list" aria-label="Sueldo típico al final según el ritmo de la IA">
          {ritmos.map((r) => (
            <span role="listitem" key={r} data-fuerte={r === ia.ritmo}>
              Con {NOMBRE_RITMO[r]}, «{nombreElegida}» terminaba en
              <b>{plata(ia.por_ritmo!.ritmos[r]!.sueldo_p50[elegida] ?? 0)}</b>
            </span>
          ))}
        </div>
      )}
      <Meta>Quién dice qué</Meta>
      <Stack gap={8}>
        {ia.voces.map((v) => (
          <div className="jg-ia-voz" key={v.quien}>
            <Text size="sm">
              <b>{v.quien}</b> <i className="jg-chico">({v.tipo})</i>: {v.dice}{" "}
              <a href={v.url} target="_blank" rel="noreferrer" className="jg-chico">Fuente</a>
            </Text>
          </div>
        ))}
      </Stack>
      <Text size="sm" className="jg-chico">{ia.fuera_del_juego}</Text>
    </Stack>
  );
}
