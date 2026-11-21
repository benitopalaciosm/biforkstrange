import { useEffect, useState } from "react";
import { cssVars } from "../tokens";

/** Estaciones de la vía: cosas que pasaron mientras no decidías (tachadas). */
export function StationTimeline({ stations }: { stations: { when: string; what: string }[] }) {
  return (
    <div className="vd-via" style={cssVars({ "--vd-via-largo": `${stations.length * 58}px` })}>
      <span className="vd-tren" aria-hidden="true" />
      {stations.map((s) => (
        <div key={s.when + s.what} className="vd-paso">
          <span className="vd-meta">{s.when}</span>
          <span className="vd-paso-que">{s.what}</span>
        </div>
      ))}
    </div>
  );
}

/** Años grandes que pasan uno tras otro y se quedan en el último. */
export function YearTicker({ years, stepMs = 1600 }: { years: (number | string)[]; stepMs?: number }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    setI(0);
    if (years.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1 >= years.length ? (clearInterval(id), n) : n + 1)), stepMs);
    return () => clearInterval(id);
  }, [years.join(","), stepMs]);

  return (
    <div className="vd-anos" role="img" aria-label={`Pasan los años: ${years.join(", ")}`}>
      <div className="vd-anos-pila" aria-hidden="true" style={{ transform: `translateY(${-84 * i}px)` }}>
        {years.map((y) => (
          <span key={y}>{y}</span>
        ))}
      </div>
    </div>
  );
}
