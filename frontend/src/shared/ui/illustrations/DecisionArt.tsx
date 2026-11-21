import type { ReactNode } from "react";

/** Ilustraciones de 72×72 para las tarjetas de decisión. */
export type DecisionArtKind = "viaje" | "consultora" | "invertir" | "magister" | "cohete" | "puerta" | "casa" | "gente" | "noche" | "quedarse";

const arts: Record<DecisionArtKind, ReactNode> = {
  viaje: (
    <>
      <rect width="72" height="72" fill="var(--acento-suave)" />
      <circle cx="52" cy="20" r="10" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2" />
      <path d="M14 44 L30 22 L34 44Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M0 50 C9 44 18 56 27 50 S45 44 54 50 S68 54 72 50 V72 H0Z" fill="var(--acento)" />
      <path d="M0 60 C9 55 18 65 27 60 S45 55 54 60 S68 63 72 60" fill="none" stroke="var(--papel)" strokeWidth="2" strokeLinecap="round" />
    </>
  ),
  consultora: (
    <>
      <rect width="72" height="72" fill="var(--niebla)" />
      <rect x="6" y="38" width="16" height="34" fill="var(--control)" />
      <rect x="52" y="30" width="16" height="42" fill="var(--control)" />
      <rect x="22" y="12" width="30" height="62" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" />
      {[20, 33, 46, 59].flatMap((y) =>
        [28, 39].map((x) =>
          x === 39 && y === 33 ? (
            <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="1.5" />
          ) : (
            <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" fill="var(--tinta)" />
          ),
        ),
      )}
    </>
  ),
  invertir: (
    <>
      <rect width="72" height="72" fill="var(--papel)" />
      <path d="M8 60 H64 M8 44 H64 M8 28 H64" stroke="var(--linea)" strokeWidth="2" strokeLinecap="round" />
      <path d="M40 26 L52 46 L64 58" fill="none" stroke="var(--control)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1 6" />
      <path d="M8 52 L20 40 L30 48 L40 26 L52 34 L64 12" fill="none" stroke="var(--dinero)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="40" cy="26" r="5" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2" />
    </>
  ),
  magister: (
    <>
      <rect width="72" height="72" fill="var(--acento-suave)" />
      <path d="M-2 64 L22 26 L36 48 L48 32 L74 64Z" fill="var(--control)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M22 26 L15 37 L21 41 L25 36 L29 40 L31 40Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="0" y="62" width="72" height="10" fill="var(--papel)" />
      <path d="M38 16 L52 9 L66 16 L52 23Z" fill="var(--tinta)" />
      <path d="M45 20 V27 C49 30 55 30 59 27 V20" fill="var(--tinta)" />
      <path d="M66 16 V26" stroke="var(--tinta)" strokeWidth="2" strokeLinecap="round" />
      <circle cx="66" cy="27" r="2.5" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="1.5" />
    </>
  ),
  cohete: (
    <>
      <rect width="72" height="72" fill="var(--acento-suave)" />
      <circle cx="14" cy="16" r="1.6" fill="var(--tinta)" />
      <circle cx="58" cy="12" r="1.6" fill="var(--tinta)" />
      <circle cx="62" cy="40" r="1.6" fill="var(--tinta)" />
      <path d="M30 52 C24 56 22 62 22 68 C28 66 34 62 36 58Z" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M28 50 L22 44 L30 40 Z M40 58 L46 64 L42 54 Z" fill="var(--carrera)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M30 52 C34 34 44 20 58 12 C54 28 44 42 36 58 Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="46" cy="30" r="4.5" fill="var(--acento)" stroke="var(--tinta)" strokeWidth="2" />
    </>
  ),
  puerta: (
    <>
      <rect width="72" height="72" fill="var(--niebla)" />
      <rect x="18" y="12" width="32" height="56" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2" />
      <path d="M18 12 L40 18 V64 L18 68 Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="35" cy="42" r="2.2" fill="var(--tinta)" />
      <path d="M50 68 H72" stroke="var(--tinta)" strokeWidth="2" />
      <path d="M54 44 H66 M60 38 L66 44 L60 50" fill="none" stroke="var(--tinta)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  casa: (
    <>
      <rect width="72" height="72" fill="var(--niebla)" />
      <path d="M12 34 L36 14 L60 34" fill="none" stroke="var(--tinta)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 30 V64 H54 V30" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="30" y="44" width="12" height="20" fill="var(--vida)" stroke="var(--tinta)" strokeWidth="2" />
      <rect x="24" y="34" width="8" height="7" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="1.5" />
      <rect x="40" y="34" width="8" height="7" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="1.5" />
      <path d="M0 64 H72" stroke="var(--tinta)" strokeWidth="2" />
    </>
  ),
  gente: (
    <>
      <rect width="72" height="72" fill="var(--acento-suave)" />
      <circle cx="26" cy="26" r="8" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2" />
      <circle cx="48" cy="30" r="7" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" />
      <path d="M10 66 C10 50 18 40 26 40 C34 40 42 50 42 66Z" fill="var(--vida)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M34 66 C34 53 40 44 48 44 C56 44 62 53 62 66Z" fill="var(--papel)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
    </>
  ),
  noche: (
    <>
      <rect width="72" height="72" fill="var(--tinta)" />
      <circle cx="56" cy="16" r="7" fill="var(--sol)" />
      <circle cx="60" cy="13" r="6" fill="var(--tinta)" />
      <rect x="14" y="22" width="34" height="50" fill="#2B2C33" stroke="#8C8D93" strokeWidth="2" />
      {[30, 42, 54].flatMap((y) =>
        [20, 34].map((x) => (
          <rect key={`${x}-${y}`} x={x} y={y} width="8" height="7" fill={x === 34 && y === 42 ? "var(--sol)" : "#45464C"} />
        )),
      )}
    </>
  ),
  quedarse: (
    <>
      <rect width="72" height="72" fill="var(--papel)" />
      <path d="M8 46 H64" stroke="var(--tinta)" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M14 46 V66 M58 46 V66" stroke="var(--tinta)" strokeWidth="2" strokeLinecap="round" />
      <rect x="20" y="18" width="26" height="20" rx="2" fill="var(--niebla)" stroke="var(--tinta)" strokeWidth="2" />
      <path d="M33 38 V46" stroke="var(--tinta)" strokeWidth="2" />
      <path d="M48 34 H58 V44 C58 46 56 46 56 46 H50 C48 46 48 44 48 44Z" fill="var(--sol)" stroke="var(--tinta)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M50 30 C50 27 53 27 53 24 M54 30 C54 27 57 27 57 24" fill="none" stroke="var(--control)" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
};

export const DECISION_ART_KINDS = Object.keys(arts) as DecisionArtKind[];

export function DecisionArt({ kind }: { kind: DecisionArtKind }) {
  return (
    <svg viewBox="0 0 72 72" width="68" height="68" aria-hidden="true" style={{ display: "block" }}>
      {arts[kind]}
    </svg>
  );
}
