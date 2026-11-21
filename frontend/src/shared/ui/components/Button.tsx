import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "../tokens";

export type ButtonVariant = "primary" | "white" | "sol" | "quiet";

const variantClass: Record<ButtonVariant, string | false> = {
  primary: false,
  white: "vd-btn--blanco",
  sol: "vd-btn--sol",
  quiet: "vd-btn--quieto",
};

type Common = { variant?: ButtonVariant; children: ReactNode };
type AsButton = Common & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLink = Common & AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

/**
 * Botón principal: una tecla que se hunde al apretarla.
 * Con `href` se dibuja como enlace; sin él, como `<button>`.
 */
export function Button(props: AsButton | AsLink) {
  const { variant = "primary", className, ...rest } = props;
  const cls = cx("vd-btn", variantClass[variant], className);
  if (rest.href !== undefined) return <a className={cls} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  return <button type="button" className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}

type IconButtonProps = { label: string; children: ReactNode } & (
  | (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (AnchorHTMLAttributes<HTMLAnchorElement> & { href: string })
);

/** Botón cuadrado de 44px con un ícono (p. ej. volver). `label` es obligatorio para accesibilidad. */
export function IconButton({ label, className, ...rest }: IconButtonProps) {
  const cls = cx("vd-icono", className);
  if (rest.href !== undefined)
    return <a className={cls} aria-label={label} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)} />;
  return <button type="button" className={cls} aria-label={label} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)} />;
}
