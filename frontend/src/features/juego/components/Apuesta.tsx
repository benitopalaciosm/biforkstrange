import "./apuesta.css";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Esperas con animaciones de apuestas: ruleta, tragamonedas, carrera de caballos, dado y naipes.
 * Cada espera nueva toma la siguiente de la lista, así no se repite la misma dos veces seguidas.
 * Son decoración: nada gira hacia una opción ni muestra números de la simulación.
 */
export type Variante = "ruleta" | "tragamonedas" | "caballos" | "dado" | "naipes";

const ORDEN: Variante[] = ["ruleta", "tragamonedas", "caballos", "dado", "naipes"];
let turno = 0;
let ultima: Variante | null = null;

function siguiente(): Variante {
  let v = ORDEN[turno++ % ORDEN.length];
  if (v === ultima) v = ORDEN[turno++ % ORDEN.length];
  return v;
}

const T = { stroke: "var(--tinta)", strokeWidth: 2, strokeLinejoin: "round" as const };
const FONDO = { x: 2, y: 2, width: 156, height: 116, rx: 18, ...T };

/* Ruleta: 12 casillas rojo/negro y una amarilla; la rueda gira para un lado y la bola para el otro. */
const CX = 80;
const CY = 61;
const punto = (r: number, grados: number) => {
  const a = ((grados - 90) * Math.PI) / 180;
  return `${(CX + r * Math.cos(a)).toFixed(2)} ${(CY + r * Math.sin(a)).toFixed(2)}`;
};
const CASILLAS = Array.from({ length: 12 }, (_, i) => ({
  d: `M${CX} ${CY} L${punto(42, i * 30)} A42 42 0 0 1 ${punto(42, (i + 1) * 30)}Z`,
  fill: i === 0 ? "var(--sol)" : i % 2 ? "var(--tinta)" : "var(--vida)",
}));

function Ruleta() {
  return (
    <>
      <rect {...FONDO} fill="var(--dinero)" />
      <circle cx={CX} cy={CY} r="48" fill="var(--niebla)" {...T} />
      <g className="ap-ruleta-rueda">
        {CASILLAS.map((c, i) => (
          <path key={i} d={c.d} fill={c.fill} stroke="var(--tinta)" strokeWidth="1.5" strokeLinejoin="round" />
        ))}
        <circle cx={CX} cy={CY} r="20" fill="var(--papel)" {...T} />
        <path d={`M${CX - 13} ${CY} H${CX + 13} M${CX} ${CY - 13} V${CY + 13}`} stroke="var(--tinta)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="6" fill="var(--sol)" {...T} />
      </g>
      <g className="ap-ruleta-bola">
        <circle cx={CX} cy={CY - 45} r="3.4" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="1.5" />
      </g>
      <path d={`M${CX - 6} 4 H${CX + 6} L${CX} 14Z`} fill="var(--sol)" {...T} />
    </>
  );
}

/* Tragamonedas: tres rodillos que nunca se detienen y la palanca que baja y sube. */
const SIMBOLOS: ((y: number) => ReactNode)[] = [
  (y) => <circle cx="12" cy={y} r="8" fill="var(--sol)" {...T} />,
  (y) => <path d={`M12 ${y - 9} L20 ${y} L12 ${y + 9} L4 ${y}Z`} fill="var(--acento)" {...T} />,
  (y) => <rect x="3" y={y - 5} width="18" height="10" rx="3" fill="var(--tinta)" />,
  (y) => <path d={`M12 ${y - 8} L20 ${y + 7} H4Z`} fill="var(--bienestar)" {...T} />,
];
const RODILLOS = [0, 2, 1];

function Tragamonedas() {
  return (
    <>
      <rect {...FONDO} fill="var(--acento-suave)" />
      <rect x="22" y="12" width="104" height="96" rx="14" fill="var(--vida)" {...T} />
      <rect x="34" y="19" width="80" height="16" rx="8" fill="var(--sol)" {...T} />
      {[52, 64, 76, 88, 100].map((x, i) => (
        <circle key={x} className="ap-luz" style={{ animationDelay: `${i * -0.16}s` }} cx={x - 2} cy="27" r="2.6" fill="var(--papel)" />
      ))}
      <rect x="30" y="42" width="88" height="42" rx="7" fill="var(--papel)" {...T} />
      {RODILLOS.map((inicio, k) => (
        <svg key={k} x={36 + k * 28} y="46" width="24" height="34">
          <g className="ap-rodillo" style={{ animationDuration: `${0.55 + k * 0.14}s` }}>
            {[0, 1, 2, 3, 4].map((n) => (
              <g key={n}>{SIMBOLOS[(inicio + n) % SIMBOLOS.length](17 + n * 34)}</g>
            ))}
          </g>
        </svg>
      ))}
      <path d="M62 46 V80 M90 46 V80" stroke="var(--linea)" strokeWidth="2" />
      <rect x="40" y="90" width="68" height="10" rx="5" fill="var(--tinta)" />
      <g className="ap-palanca">
        <path d="M134 70 L140 31" stroke="var(--tinta)" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="140" cy="31" r="6.5" fill="var(--sol)" {...T} />
      </g>
      <rect x="127" y="63" width="14" height="14" rx="4" fill="var(--control)" {...T} />
    </>
  );
}

/* Carrera: tres caballos que se pasan y se vuelven a pasar; no hay meta, nadie gana. */
const COLORES = ["var(--acento)", "var(--vida)", "var(--bienestar)"];

function Caballo({ color }: { color: string }) {
  const pata = { stroke: "var(--tinta)", strokeWidth: 2.5, strokeLinecap: "round" as const };
  return (
    <g className="ap-trote">
      <g className="ap-pata-a">
        <path d="M-7 -7 L-12 0 M-4 -7 L-7 0 M5 -7 L10 0 M8 -7 L13 -1" {...pata} />
      </g>
      <g className="ap-pata-b">
        <path d="M-7 -7 L-4 -1 M-4 -7 L-1 0 M5 -7 L3 0 M8 -7 L6 -1" {...pata} />
      </g>
      <path d="M-10 -13 Q-17 -13 -18 -6" fill="none" stroke="var(--tinta)" strokeWidth="2.5" strokeLinecap="round" />
      <ellipse cx="0" cy="-11" rx="11" ry="5.5" fill="var(--papel)" {...T} />
      <path d="M6 -14 L12 -23 Q14 -25 17 -23 L19 -19 Q19 -17 17 -17 L13 -18 L10 -9Z" fill="var(--papel)" {...T} />
      <rect x="-5" y="-17" width="9" height="6" rx="1.5" fill={color} stroke="var(--tinta)" strokeWidth="1.5" />
      <circle cx="0" cy="-21" r="3.6" fill={color} stroke="var(--tinta)" strokeWidth="1.5" />
    </g>
  );
}

function Caballos() {
  return (
    <>
      <rect {...FONDO} fill="var(--acento-suave)" />
      <svg x="2" y="2" width="156" height="116">
        <path className="ap-pasto" d="M0 34 H156 V98 A18 18 0 0 1 138 116 H18 A18 18 0 0 1 0 98Z" />
        <path d="M0 27 H156 M0 34 H156" stroke="var(--tinta)" strokeWidth="2" />
        <g className="ap-avanza">
          {Array.from({ length: 12 }, (_, i) => (
            <rect key={i} x={i * 16 + 4} y="22" width="4" height="15" rx="1" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="1.5" />
          ))}
          <path d="M-8 59 H176 M-8 81 H176" stroke="var(--papel)" strokeWidth="2" strokeDasharray="8 8" />
        </g>
        {[55, 77, 99].map((y, i) => (
          <g key={y} transform={`translate(76 ${y}) scale(1.15)`}>
            <g className="ap-carrera" style={{ animationDuration: `${3 + i * 0.55}s`, animationDelay: `${-i * 1.3}s` }}>
              <Caballo color={COLORES[i]} />
            </g>
          </g>
        ))}
      </svg>
      <rect {...FONDO} fill="none" />
    </>
  );
}

/* Dado: salta, da un cuarto de vuelta y cambia de cara en el aire. */
const PUNTOS: [number, number][][] = [
  [[0, 0]],
  [[-12, -12], [12, 12]],
  [[-12, -12], [0, 0], [12, 12]],
  [[-12, -12], [12, -12], [-12, 12], [12, 12]],
  [[-12, -12], [12, -12], [0, 0], [-12, 12], [12, 12]],
  [[-12, -12], [12, -12], [-12, 0], [12, 0], [-12, 12], [12, 12]],
];

function Dado() {
  return (
    <>
      <rect {...FONDO} fill="var(--acento)" />
      <ellipse className="ap-sombra" cx="80" cy="96" rx="24" ry="4.5" fill="var(--tinta)" opacity=".3" />
      <g className="ap-dado">
        <rect x="54" y="38" width="52" height="52" rx="11" fill="var(--sol)" {...T} />
        {PUNTOS.map((cara, k) => (
          <g key={k} className="ap-cara" data-cara={k + 1} style={{ animationDelay: `${0.48 + k * 1.2 - 7.2}s` }}>
            {cara.map(([x, y]) => (
              <circle key={`${x}${y}`} cx={80 + x} cy={64 + y} r="4.6" fill="var(--tinta)" />
            ))}
          </g>
        ))}
      </g>
    </>
  );
}

/* Naipes: tres cartas en abanico que se dan vuelta una tras otra, sin número. */
const PINTAS: { d: string; fill: string }[] = [
  { d: "M0 6 C-8 0 -8 -7 -3.5 -7 C-1.5 -7 0 -5.5 0 -4 C0 -5.5 1.5 -7 3.5 -7 C8 -7 8 0 0 6Z", fill: "var(--vida)" },
  { d: "M0 -8 L6 0 L0 8 L-6 0Z", fill: "var(--bienestar)" },
  { d: "M0 -8 C-8 -1 -7 5 -2.5 4 C-1.5 4 -1 3.5 -0.8 3 L-2 8 H2 L0.8 3 C1 3.5 1.5 4 2.5 4 C7 5 8 -1 0 -8Z", fill: "var(--tinta)" },
];

function Naipes() {
  return (
    <>
      <rect {...FONDO} fill="var(--sol)" />
      {[44, 80, 116].map((x, i) => (
        <g key={x} transform={`rotate(${(i - 1) * 8} ${x} 62)`}>
          <g className="ap-naipe" style={{ animationDelay: `${-i * 0.35}s` }}>
            <g className="ap-dorso">
              <rect x={x - 19} y="34" width="38" height="56" rx="6" fill="var(--acento)" {...T} />
              <rect x={x - 13} y="40" width="26" height="44" rx="3" fill="none" stroke="var(--papel)" strokeWidth="1.5" />
              <path d={`M${x} 52 L${x + 7} 62 L${x} 72 L${x - 7} 62Z`} fill="var(--papel)" />
            </g>
            <g className="ap-frente" style={{ animationDelay: `${-i * 0.35}s` }}>
              <rect x={x - 19} y="34" width="38" height="56" rx="6" fill="var(--papel)" {...T} />
              <path d={PINTAS[i].d} fill={PINTAS[i].fill} transform={`translate(${x} 62) scale(1.5)`} />
              <path d={PINTAS[i].d} fill={PINTAS[i].fill} transform={`translate(${x - 11} 44) scale(.6)`} />
              <path d={PINTAS[i].d} fill={PINTAS[i].fill} transform={`translate(${x + 11} 80) rotate(180) scale(.6)`} />
            </g>
          </g>
        </g>
      ))}
    </>
  );
}

const ESCENAS: Record<Variante, () => ReactNode> = { ruleta: Ruleta, tragamonedas: Tragamonedas, caballos: Caballos, dado: Dado, naipes: Naipes };

/**
 * Espera entretenida mientras se simula, se tira el dado o Claude lee.
 * `texto` es una sola línea corta; con `frases` el texto va rotando cada `cada` ms.
 * `pantalla` la pone a pantalla completa (la noche del año), `compacto` la deja chica al lado del texto.
 */
export function Espera({
  texto,
  frases,
  cada = 2400,
  variante,
  titulo,
  pantalla = false,
  compacto = false,
}: {
  texto?: string;
  frases?: string[];
  cada?: number;
  variante?: Variante;
  titulo?: string;
  pantalla?: boolean;
  compacto?: boolean;
}) {
  const [elegida] = useState<Variante>(() => {
    const v = variante ?? siguiente();
    ultima = v;
    return v;
  });
  const [n, setN] = useState(0);
  const total = frases?.length ?? 0;
  useEffect(() => {
    if (total < 2) return;
    const id = window.setInterval(() => setN((x) => x + 1), cada);
    return () => window.clearInterval(id);
  }, [total, cada]);
  const linea = total ? frases![n % total] : texto;
  const Escena = ESCENAS[elegida];
  return (
    <div className="ap-espera" data-modo={pantalla ? "pantalla" : compacto ? "compacto" : "bloque"} role="status" aria-live="polite">
      {titulo && <span className="ap-titulo">{titulo}</span>}
      <svg className="ap-escena" data-variante={elegida} viewBox="0 0 160 120" aria-hidden="true" focusable="false">
        <Escena />
      </svg>
      {linea && (
        <p className="ap-texto" key={linea}>
          {linea}
        </p>
      )}
    </div>
  );
}
