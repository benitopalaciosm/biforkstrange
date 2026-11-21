import type { CSSProperties } from "react";
import { cssVars, cx } from "./tokens";

/**
 * Reloj de escena.
 *
 * Una sola variable CSS, --vd-t, avanza de 0 a 1 y todo lo animado de la escena se
 * calcula desde ella, así nada se desincroniza. La pone <Screen scene="once" | "loop">.
 *  · "once": corre una vez (14,4 s) y se queda en el cuadro final (.9). Es lo de la app.
 *  · "loop": se repite cada 16 s, como en el prototipo.
 * Para repetir la escena (p. ej. al entrar a otro año) cambia la `key` del <Screen>.
 *
 * Cualquier elemento puede "entrar" en un momento de la vuelta con `gate(at, kind)`.
 */
export type SceneMode = "once" | "loop";

export const sceneClass = (mode?: SceneMode) => (mode ? cx("vd-t", mode === "once" && "vd-t--una") : undefined);

export type GateKind = "ver" | "hasta" | "sube" | "cae" | "pop" | "onda";

/** Props para que un elemento aparezca en el momento `at` (0–1) del reloj de escena. */
export function gate(at: number | undefined, kind?: GateKind): { className?: string; style?: CSSProperties } {
  if (at === undefined) return {};
  return { className: cx("vd-g", kind && `vd-g-${kind}`), style: cssVars({ "--a": at }) };
}
