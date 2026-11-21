import type { ReactNode } from "react";
import { gate } from "../scene";
import { cx } from "../tokens";

/** Círculo amarillo con la inicial (o la que pases en `initial`). */
export function Avatar({ name, initial }: { name: string; initial?: string }) {
  return (
    <span className="vd-avatar" aria-hidden="true">
      {initial ?? name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Mensaje que llegó y no contestaste. */
export function Notification({
  from,
  message,
  time,
  initial,
  revealAt,
}: {
  from: string;
  /** Letra del avatar, si no es la primera de `from` (p. ej. "C" para "Los cabros"). */
  initial?: string;
  message: string;
  time?: string;
  /** Dentro de una escena: momento en que cae la notificación. */
  revealAt?: number;
}) {
  const g = gate(revealAt, "cae");
  return (
    <div className={cx("vd-noti", g.className)} style={g.style}>
      <Avatar name={from} initial={initial} />
      <span className="vd-noti-texto">
        <span className="vd-noti-quien">{from}</span>
        <span className="vd-noti-msg vd-truncar">{message}</span>
      </span>
      {time && <span className="vd-noti-hora">{time}</span>}
    </div>
  );
}

export type DotKind = "seen" | "missed" | "end";

/** Un punto: una vez que fuiste, una invitación perdida o un final. */
export function Dot({ kind = "seen" }: { kind?: DotKind }) {
  return <span className={cx("vd-punto", kind === "missed" && "vd-punto--no", kind === "end" && "vd-punto--fin")} />;
}

/** Fila de puntos "cada punto es una vez". */
export function DotRow({ seen, missed = 0, end }: { seen: number; missed?: number; end?: boolean }) {
  const dots: DotKind[] = [...Array(seen).fill("seen"), ...Array(missed).fill("missed"), ...(end ? ["end" as const] : [])];
  return (
    <div className="vd-puntos" role="img" aria-label={`${seen} de ${seen + missed} veces`}>
      {dots.map((k, i) => (
        <Dot key={i} kind={k} />
      ))}
    </div>
  );
}

/** Persona con su fila de puntos y el conteo a la derecha. */
export function PeopleTally({
  who,
  seen,
  missed,
  end,
  unit = "veces",
}: {
  who: string;
  seen: number;
  missed: number;
  end?: boolean;
  unit?: string;
}) {
  return (
    <div className="vd-pila" style={{ gap: 6 }}>
      <div className="vd-ind-fila">
        <span className="vd-ind-n">{who}</span>
        <span className="vd-ind-v">
          {seen} {unit}
        </span>
      </div>
      <DotRow seen={seen} missed={missed} end={end} />
    </div>
  );
}

/** Leyenda de los puntos. */
export function DotLegend({ items }: { items: { kind: DotKind; label: ReactNode }[] }) {
  return (
    <div className="vd-leyenda">
      {items.map((it, i) => (
        <span key={i} className="vd-leyenda-item">
          <Dot kind={it.kind} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Lista "Lo que te perdiste". */
export function MissedList({ items, revealAt }: { items: string[]; revealAt?: number }) {
  return (
    <div className="vd-pila" style={{ gap: 4 }}>
      {items.map((it, i) => {
        const g = gate(revealAt !== undefined ? revealAt + i * 0.04 : undefined, "sube");
        return (
          <div key={it} className={cx("vd-perdido", g.className)} style={g.style}>
            <Dot kind="missed" />
            <span>{it}</span>
          </div>
        );
      })}
    </div>
  );
}
