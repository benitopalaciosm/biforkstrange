import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "../tokens";

type HeadingProps = HTMLAttributes<HTMLHeadingElement> & {
  /** Tamaño visual: 1 = 34px, 2 = 24px, 3 = 18px. */
  level?: 1 | 2 | 3;
  /** Etiqueta HTML, si debe diferir del tamaño visual. */
  as?: "h1" | "h2" | "h3" | "h4";
};

export function Heading({ level = 1, as, className, ...rest }: HeadingProps) {
  const Tag = as ?? (`h${level}` as const);
  return <Tag className={cx(`vd-h${level}`, className)} {...rest} />;
}

export function Text({ size = "md", className, ...rest }: HTMLAttributes<HTMLParagraphElement> & { size?: "md" | "sm" }) {
  return <p className={cx(size === "sm" ? "vd-p-sm" : "vd-p", className)} {...rest} />;
}

/** Etiqueta mono en mayúsculas: fechas, contadores, rótulos de sección. */
export function Meta({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cx("vd-meta", className)} {...rest} />;
}

/** Pastilla con borde: año y edad, nombre de la pantalla. */
export function Pill({ tone = "default", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "sol" }) {
  return <span className={cx("vd-pildora", tone === "sol" && "vd-pildora--sol", className)} {...rest} />;
}

/** Número grande con unidad opcional ("61 / 100", "2 veces la viste"). */
export function BigNumber({ value, unit, animate }: { value: ReactNode; unit?: ReactNode; animate?: boolean }) {
  return (
    <div className="vd-num-fila">
      <span className={cx("vd-num", animate && "vd-subir")}>{value}</span>
      {unit != null && <span className="vd-num-unidad">{unit}</span>}
    </div>
  );
}

/** Texto de relato, grande y lento. `strong` para la línea que pega. */
export function Narrative({ strong, className, ...rest }: HTMLAttributes<HTMLParagraphElement> & { strong?: boolean }) {
  return <p className={cx("vd-relato", strong && "vd-relato--fuerte", className)} {...rest} />;
}
