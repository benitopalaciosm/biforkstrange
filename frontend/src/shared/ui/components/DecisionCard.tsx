import type { ReactNode } from "react";
import { CheckIcon } from "./Icon";
import { Tag } from "./Controls";

export type DecisionTag = { label: string; tone?: "default" | "minus" | "accent" | "sol" };

/** Tarjeta de un camino posible en la decisión del año. Se hunde al elegirla. */
export function DecisionCard({
  art,
  title,
  subtitle,
  tags = [],
  selected,
  onSelect,
}: {
  /** Ilustración de 72×72, p. ej. <DecisionArt kind="viaje" />. */
  art: ReactNode;
  title: string;
  subtitle?: string;
  tags?: DecisionTag[];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button type="button" className="vd-opcion" aria-pressed={selected} onClick={onSelect}>
      <span className="vd-opcion-dibujo">{art}</span>
      <span className="vd-opcion-texto">
        <span className="vd-opcion-titulo">{title}</span>
        {subtitle && <span className="vd-opcion-sub">{subtitle}</span>}
        {tags.length > 0 && (
          <span className="vd-opcion-tags">
            {tags.map((t) => (
              <Tag key={t.label} tone={t.tone}>
                {t.label}
              </Tag>
            ))}
          </span>
        )}
      </span>
      <span className="vd-opcion-check">
        <CheckIcon />
      </span>
    </button>
  );
}

/** Lista de caminos con selección única. */
export function DecisionList<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: ({ id: T } & Omit<Parameters<typeof DecisionCard>[0], "selected" | "onSelect">)[];
  value: T | null;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div className="vd-pila" role="group" aria-label={label} style={{ gap: 14 }}>
      {options.map(({ id, ...o }) => (
        <DecisionCard key={id} {...o} selected={value === id} onSelect={() => onChange(id)} />
      ))}
    </div>
  );
}
