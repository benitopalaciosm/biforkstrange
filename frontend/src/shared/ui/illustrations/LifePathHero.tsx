/**
 * Portada: tu vida como una línea. El pasado en tinta, el camino elegido en acento
 * y dos caminos alternativos punteados. Solo cambian los textos.
 */
export function LifePathHero({
  past = ["Colegio", "Universidad"],
  today = "Tú, hoy",
  chosen = "Australia",
  alternatives = ["Consultora", "Magíster"],
}: {
  past?: [string, string];
  today?: string;
  chosen?: string;
  alternatives?: [string, string];
}) {
  return (
    <svg
      viewBox="0 0 350 300"
      width="100%"
      role="img"
      aria-label={`Tu vida como una línea: ${past.join(" y ")} y, desde hoy, tres caminos posibles: ${chosen}, ${alternatives.join(" o ")}`}
      style={{ display: "block", flex: "none", maxWidth: 350 }}
    >
      <circle cx="300" cy="60" r="40" fill="var(--sol)" />
      <path d="M150 170 C220 180 260 170 320 160" fill="none" stroke="var(--control)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 12" />
      <path d="M150 170 C190 220 250 240 310 250" fill="none" stroke="var(--control)" strokeWidth="6" strokeLinecap="round" strokeDasharray="1 12" />
      <path d="M30 280 C30 200 100 200 150 170" fill="none" stroke="var(--tinta)" strokeWidth="10" strokeLinecap="round" />
      <path className="vd-trazo" d="M150 170 C200 150 210 90 300 60" fill="none" stroke="var(--acento)" strokeWidth="10" strokeLinecap="round" />
      <circle cx="30" cy="280" r="8" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="3" />
      <circle cx="71" cy="206" r="8" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="3" />
      <circle cx="320" cy="160" r="8" fill="var(--papel)" stroke="var(--control)" strokeWidth="3" />
      <circle cx="310" cy="250" r="8" fill="var(--papel)" stroke="var(--control)" strokeWidth="3" />
      <circle cx="210" cy="119" r="7" fill="var(--papel)" stroke="var(--acento)" strokeWidth="3" />
      <circle cx="300" cy="60" r="10" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="3" />
      <circle className="vd-latido" cx="150" cy="170" r="13" fill="var(--acento)" />
      <circle cx="150" cy="170" r="13" fill="var(--acento)" stroke="var(--tinta)" strokeWidth="3" />
      <text className="vd-svg-s" x="46" y="284">{past[0]}</text>
      <text className="vd-svg-s" x="86" y="226">{past[1]}</text>
      <text className="vd-svg-t" x="136" y="148" textAnchor="end">{today}</text>
      <text className="vd-svg-t" x="300" y="120" textAnchor="middle">{chosen}</text>
      <text className="vd-svg-s" x="318" y="190" textAnchor="end">{alternatives[0]}</text>
      <text className="vd-svg-s" x="308" y="278" textAnchor="end">{alternatives[1]}</text>
    </svg>
  );
}
