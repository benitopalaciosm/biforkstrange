import { gate } from "../scene";
import { PhoneIcon } from "../components/Icon";

/**
 * Escena "Las noches largas": cae la noche, las luces de la oficina se apagan una a una,
 * el reloj avanza y la cámara se acerca a la única ventana encendida, la tuya.
 * Necesita el reloj de escena: úsala dentro de <Screen tone="noche" scene="once">.
 *
 * Tiempos (fracción de la vuelta): anochecer .04→.30 · el reloj salta en .10 .20 .30 .38 .48 · acercarse .50→.59
 * El contador "sin leer" sube en .20, .30 y .38 (calza con tres <Notification revealAt>).
 */

// Ventanas que se apagan: [x, y, size, momento] (sin momento = siempre apagada)
const WINDOWS: [number, number, number, number?][] = [
  [26, 124, 8, 0.1], [26, 142, 8], [38, 160, 8, 0.06], [60, 98, 8, 0.14], [74, 98, 8], [74, 134, 8, 0.18], [60, 152, 8],
  [272, 108, 8, 0.22], [286, 108, 8], [272, 144, 8, 0.06], [316, 140, 8, 0.14], [316, 166, 8, 0.1],
  [121, 56, 16, 0.08], [153, 56, 16], [185, 56, 16, 0.26], [217, 56, 16, 0.14],
  [121, 84, 16, 0.34], [153, 84, 16, 0.44], [217, 84, 16, 0.2],
  [121, 112, 16, 0.12], [153, 112, 16], [185, 112, 16, 0.3], [217, 112, 16, 0.4],
  [121, 140, 16], [153, 140, 16, 0.18], [185, 140, 16, 0.24], [217, 140, 16],
  [121, 168, 16, 0.06], [153, 168, 16], [185, 168, 16, 0.1], [217, 168, 16, 0.16],
];

const STARS: [number, number, number, number][] = [
  [96, 22, 1.5, 0.18], [268, 34, 1.5, 0.22], [310, 16, 1, 0.26], [176, 14, 1, 0.3], [28, 62, 1, 0.34], [328, 58, 1.5, 0.38],
];

export function OfficeScene({
  times = ["18:30", "19:40", "21:10", "22:30", "23:05", "01:20"],
  label,
}: {
  /** Seis horas que muestra el reloj, en orden. */
  times?: string[];
  label?: string;
}) {
  const unread = gate(0.2, "sube");
  return (
    <div className="vd-escena vd-oficina" style={{ width: "100%", maxWidth: 350, aspectRatio: "350 / 200" }}>
      <svg
        viewBox="0 0 350 200"
        role="img"
        aria-label={
          label ??
          `Un edificio de oficinas al atardecer: cae la noche, las luces se apagan una a una y la cámara se acerca a la única ventana encendida, la tuya, a las ${times[times.length - 1]}`
        }
      >
        <g className="vd-camara">
          <rect className="vd-cielo" width="350" height="200" />
          <g className="vd-ocaso">
            <rect x="0" y="100" width="350" height="24" fill="#D6336C" opacity=".55" />
            <rect x="0" y="124" width="350" height="76" fill="#F08A1C" opacity=".9" />
            <circle className="vd-ocaso-sol" cx="254" cy="116" r="22" fill="#FFC83D" />
          </g>
          {STARS.map(([cx, cy, r, at]) => {
            const g = gate(at, "ver");
            return <circle key={`${cx}-${cy}`} className={g.className} style={g.style} cx={cx} cy={cy} r={r} fill="#A9AAB2" />;
          })}
          <circle className="vd-luna" cx="40" cy="110" r="12" fill="#F2F2EF" />

          <rect x="18" y="112" width="62" height="90" fill="#1B1C23" />
          <rect x="50" y="86" width="40" height="116" fill="#22232B" />
          <rect x="262" y="96" width="46" height="106" fill="#22232B" />
          <rect x="296" y="128" width="40" height="74" fill="#1B1C23" />
          <rect x="105" y="40" width="140" height="162" fill="#1B1C23" stroke="#F2F2EF" strokeWidth="2" />
          {WINDOWS.map(([x, y, s, at]) => {
            const g = gate(at);
            return (
              <rect key={`${x}-${y}`} className={`vd-vent ${g.className ?? ""}`} style={g.style} x={x} y={y} width={s} height={s} />
            );
          })}
          <rect className="vd-halo" x="179" y="78" width="28" height="28" rx="5" fill="#FFC83D" />
          <rect className="vd-vent vd-vent--tu" x="185" y="84" width="16" height="16" />
          <g className="vd-tu-figura" fill="#14151A">
            <circle cx="193" cy="91" r="2.6" />
            <path d="M187.5 100 C187.5 94.6 198.5 94.6 198.5 100Z" />
            <rect x="189.5" y="97.4" width="7" height="1.4" rx=".7" fill="#F2F2EF" />
          </g>
        </g>
      </svg>
      <div className="vd-hora" aria-hidden="true">
        <div className="vd-hora-pila">
          {times.slice(0, 6).map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
      </div>
      <div className={`vd-sinleer ${unread.className}`} style={unread.style} aria-hidden="true">
        <PhoneIcon />
        <span className="vd-sinleer-n" />
        <span>sin leer</span>
      </div>
      <div className="vd-telon" aria-hidden="true" />
    </div>
  );
}
