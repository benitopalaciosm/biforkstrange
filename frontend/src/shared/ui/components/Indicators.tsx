import { gate } from "../scene";
import { INDICATORS, cssVars, cx, indicatorColor, signed, type IndicatorKey, type IndicatorValues } from "../tokens";

type IndicatorProps = {
  indicator: IndicatorKey;
  /** Valor actual, 0–100. */
  value: number;
  /** Valor anterior. Si viene, se muestra el cambio en vez del valor. */
  previous?: number;
  /** Nombre a mostrar; por defecto el del indicador. */
  label?: string;
  /**
   * Dentro de una escena (<Screen scene>): momento en que aparece el cambio.
   * La barra parte del valor anterior y se mueve al nuevo con el reloj.
   */
  revealAt?: number;
};

/**
 * Un indicador: nombre, valor o cambio, y la barra.
 * Si subió, una rayita marca dónde estaba. Si bajó, un tramo rayado muestra lo que se perdió.
 */
export function Indicator({ indicator, value, previous, label, revealAt }: IndicatorProps) {
  const v = Math.round(value);
  const delta = previous === undefined ? undefined : v - Math.round(previous);
  const fell = delta !== undefined && delta < 0;
  const de = previous !== undefined && v > 0 ? previous / v : 1;
  const pill = gate(revealAt, "pop");
  const lost = gate(revealAt !== undefined ? revealAt + 0.04 : undefined);

  return (
    <div className="vd-ind" style={revealAt !== undefined ? cssVars({ "--de": de.toFixed(3) }) : undefined}>
      <div className="vd-ind-top">
        <span className="vd-ind-n">{label ?? INDICATORS.find((i) => i.key === indicator)!.label}</span>
        {delta === undefined ? (
          <span className="vd-ind-v">{v}</span>
        ) : (
          <span className={cx("vd-ind-d", fell && "vd-ind-d--baja", pill.className)} style={pill.style}>
            {signed(delta)}
          </span>
        )}
      </div>
      <div className="vd-barra" role="img" aria-label={`${v} de 100`}>
        <i style={{ width: `${v}%`, background: indicatorColor(indicator) }} />
        {previous !== undefined && !fell && <b style={{ left: `${previous}%` }} />}
        {fell && <u className={lost.className} style={{ ...lost.style, left: `${v}%`, width: `${-delta!}%` }} />}
      </div>
    </div>
  );
}

/** Los cuatro indicadores en grilla de 2×2. */
export function IndicatorGrid({
  values,
  previous,
  label,
  revealAt,
}: {
  values: IndicatorValues;
  previous?: IndicatorValues;
  /** Descripción accesible, p. ej. "Cómo estás hoy". */
  label: string;
  /** Ver <Indicator revealAt>. Cada indicador entra un poco después del anterior. */
  revealAt?: number;
}) {
  return (
    <div className="vd-inds" role="group" aria-label={label}>
      {INDICATORS.map(({ key }, i) => (
        <Indicator
          key={key}
          indicator={key}
          value={values[key]}
          previous={previous?.[key]}
          revealAt={revealAt !== undefined ? revealAt + i * 0.01 : undefined}
        />
      ))}
    </div>
  );
}
