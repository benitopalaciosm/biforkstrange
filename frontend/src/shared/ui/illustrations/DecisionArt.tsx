import type { ReactNode } from "react";

/** Ilustraciones de 72×72 para las tarjetas de decisión. */
export type DecisionArtKind = "viaje" | "consultora" | "invertir" | "magister";

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
};

export const DECISION_ART_KINDS = Object.keys(arts) as DecisionArtKind[];

export function DecisionArt({ kind }: { kind: DecisionArtKind }) {
  return (
    <svg viewBox="0 0 72 72" width="68" height="68" aria-hidden="true" style={{ display: "block" }}>
      {arts[kind]}
    </svg>
  );
}
