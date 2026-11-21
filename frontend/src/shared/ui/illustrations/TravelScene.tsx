import { gate } from "../scene";

/**
 * Escena "Work and travel": mapa del Pacífico; el avión despega de Santiago, la cámara lo sigue
 * a tres paradas y al final se aleja para mostrar la ruta. Un contador de días corre de 1 a 365.
 * Necesita el reloj de escena: úsala dentro de <Screen scene="once">.
 *
 * Tramos (inicio, duración): origen→1 .05/.21 · →2 .30/.08 · →3 .42/.07 · alejarse .52/.07
 * La geometría es fija; solo cambian los nombres de las paradas.
 */
const ROUTE = "M290 205 C230 250 190 250 150 212 C125 190 105 170 85 155 C70 140 55 120 48 100";

export function TravelScene({
  origin = "Santiago",
  stops = ["Sídney", "Bali", "Bangkok"],
  label,
}: {
  origin?: string;
  stops?: [string, string, string];
  label?: string;
}) {
  const arrive = [0.26, 0.38, 0.49];
  const pts: [number, number, number][] = [
    [150, 212, 7],
    [85, 155, 6],
    [48, 100, 6],
  ];
  const labelPos: [number, number, "start" | "end"][] = [
    [162, 200, "start"],
    [40, 162, "end"],
    [60, 96, "start"],
  ];
  return (
    <div className="vd-escena vd-viaje" style={{ width: "100%", maxWidth: 350, aspectRatio: "350 / 236" }}>
      <svg
        viewBox="0 0 350 236"
        role="img"
        aria-label={label ?? `Mapa: despegas de ${origin}, la cámara te sigue hasta ${stops.join(", ")}, y al final se aleja para mostrar la ruta completa`}
      >
        <g transform="translate(0 -24)">
          <g className="vd-camara">
            <rect x="0" y="0" width="350" height="300" fill="var(--acento-suave)" />
            <g className="vd-ola" fill="none" stroke="var(--acento)" strokeWidth="2" strokeLinecap="round" opacity=".45">
              {[[196, 96], [224, 150], [170, 60], [24, 226], [232, 222], [200, 262], [120, 250]].map(([x, y]) => (
                <path key={`${x}-${y}`} d={`M${x} ${y} q6 -5 12 0 t12 0`} />
              ))}
            </g>
            <path d="M0 40 C30 30 70 50 72 85 C74 110 55 118 48 135 C42 120 40 100 20 95 C8 92 0 85 0 85Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
            <ellipse cx="60" cy="150" rx="10" ry="4" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="1.5" />
            <ellipse cx="85" cy="155" rx="9" ry="4" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="1.5" />
            <ellipse cx="108" cy="152" rx="10" ry="4" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="1.5" />
            <path d="M70 190 C85 170 120 168 145 180 C160 190 158 215 140 228 C120 240 95 236 78 226 C64 216 60 202 70 190Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M290 90 C320 85 345 110 335 140 C328 165 318 185 312 215 C308 240 300 262 292 262 C284 250 286 220 284 195 C282 165 268 140 272 115 C274 100 280 92 290 90Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />

            <path d={ROUTE} fill="none" stroke="var(--control)" strokeWidth="2" strokeLinecap="round" strokeDasharray="1 7" />
            <path className="vd-estela" d={ROUTE} fill="none" stroke="var(--acento)" strokeWidth="5" strokeLinecap="round" />

            <g {...gate(0.05, "hasta")}>
              <circle className="vd-latido" cx="290" cy="205" r="7" fill="var(--acento)" />
            </g>
            <circle cx="290" cy="205" r="6" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2.5" />
            {pts.map(([x, y]) => (
              <circle key={`d${x}`} cx={x} cy={y} r="3" fill="var(--papel)" stroke="var(--control)" strokeWidth="1.5" />
            ))}
            {pts.map(([x, y, r], i) => (
              <circle key={`o${x}`} {...gate(arrive[i], "onda")} cx={x} cy={y} r={r} fill="none" stroke="var(--tinta)" strokeWidth="2" />
            ))}
            {pts.map(([x, y, r], i) => (
              <circle key={`p${x}`} {...gate(arrive[i], "pop")} cx={x} cy={y} r={r - 1} fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2.5" />
            ))}

            <text className="vd-svg-t" x="280" y="192" textAnchor="end">
              {origin}
            </text>
            {stops.map((s, i) => {
              const g = gate(arrive[i], "ver");
              return (
                <text key={s} className={`vd-svg-t ${g.className}`} style={g.style} x={labelPos[i][0]} y={labelPos[i][1]} textAnchor={labelPos[i][2]}>
                  {s}
                </text>
              );
            })}

            <g className="vd-vuelo vd-vuelo--sombra">
              <ellipse className="vd-vuelo-sombra" cx="0" cy="0" rx="9" ry="4" fill="var(--tinta)" />
            </g>
            <g className="vd-vuelo">
              <path className="vd-vuelo-cuerpo" d="M-10 -7 L10 0 L-10 7 L-5 0Z" fill="var(--tinta)" stroke="var(--papel)" strokeWidth="1.5" strokeLinejoin="round" />
            </g>
          </g>
        </g>
        <g {...gate(0.52, "hasta")} aria-hidden="true">
          <g transform="translate(0 22)">
            <path className="vd-nube" d="M0 16 C0 9 8 6 13 9 C15 1 30 0 34 8 C42 5 50 10 48 16Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
          </g>
          <g transform="translate(0 186) scale(1.35)">
            <path className="vd-nube vd-nube--b" d="M0 16 C0 9 8 6 13 9 C15 1 30 0 34 8 C42 5 50 10 48 16Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="1.5" strokeLinejoin="round" />
          </g>
        </g>
      </svg>
      <div className="vd-dia" aria-hidden="true">
        <span>Día</span>
        <span className="vd-dia-n" />
      </div>
      <div className="vd-telon" aria-hidden="true" />
    </div>
  );
}
