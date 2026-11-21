import type { ReactNode } from "react";
import { Tag } from "@/shared/ui";

export type BarItem = { key: string | number; label: string; prob: number; mark?: ReactNode };

/** "menos de 1%" para que una barra casi vacía no diga 0%. */
export function pctTexto(prob: number) {
  const n = Math.round(prob * 100);
  return n === 0 && prob > 0 ? "menos de 1%" : `${n}%`;
}

/** Barras horizontales con porcentaje. El ancho es proporcional a la probabilidad (100% = barra llena). */
export function BarList({ items, color = "var(--acento)" }: { items: BarItem[]; color?: string }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
      {items.map((it) => (
        <li key={it.key}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, font: "500 14px/20px var(--font)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {it.label}
              {it.mark != null && <Tag tone="sol">{it.mark}</Tag>}
            </span>
            <span style={{ fontFamily: "var(--mono)", whiteSpace: "nowrap" }}>{pctTexto(it.prob)}</span>
          </div>
          <div style={{ height: 10, marginTop: 4, borderRadius: 999, background: "var(--linea)", overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, it.prob * 100)}%`, height: "100%", borderRadius: 999, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
