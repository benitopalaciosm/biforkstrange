import type { ReactNode } from "react";
import { Avatar, Button, Tag, cx } from "@/shared/ui";
import { CALIDAD, plata } from "../textos";
import type { Calidad, Rango } from "../types";

/** Calidad del dato, discreta: dato / mixto / supuesto. */
export function CalidadTag({ calidad }: { calidad: Calidad }) {
  const c = CALIDAD[calidad];
  if (!c) return null;
  return (
    <span title={c.explica}>
      <Tag tone={calidad === "supuesto" ? "minus" : "default"}>{c.nombre}</Tag>
    </span>
  );
}

export function LeyendaCalidad() {
  return (
    <p className="jg-chico" style={{ margin: 0 }}>
      Cada número dice de dónde sale. Dato: {CALIDAD.dato.explica.toLowerCase()} Mixto: {CALIDAD.mixto.explica.toLowerCase()}{" "}
      Supuesto: {CALIDAD.supuesto.explica.toLowerCase()}
    </p>
  );
}

/**
 * Rango de sueldos de los gemelos de una opción, del 10% peor al 10% mejor, con la raya en el gemelo del medio.
 * Usa la pista de <RangeCompare> del kit, pero en pesos y con una escala común (`tope`) para todas las opciones.
 */
export function RangoSueldo({ rango, tope, color = "var(--dinero)" }: { rango: Rango; tope: number; color?: string }) {
  const pos = (n: number) => (tope > 0 ? Math.min(100, Math.max(0, (n / tope) * 100)) : 0);
  return (
    <span
      className="vd-pila"
      style={{ gap: 4 }}
      role="img"
      aria-label={`Del 10% peor, ${plata(rango.p10)}, al 10% mejor, ${plata(rango.p90)}. El gemelo del medio: ${plata(rango.p50)}`}
    >
      <span className="vd-rango-pista">
        <i style={{ left: `${pos(rango.p10)}%`, width: `${Math.max(pos(rango.p90) - pos(rango.p10), 2)}%`, background: color }} />
        <b style={{ left: `${pos(rango.p50)}%` }} />
      </span>
      <span className="jg-extremos">
        <span>{plata(rango.p10)}</span>
        <span>{plata(rango.p90)}</span>
      </span>
    </span>
  );
}

export function Cargando({ children }: { children: ReactNode }) {
  return (
    <div className="jg-cargando" role="status">
      <i aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export function ErrorCaja({ error, onReintentar }: { error: string; onReintentar?: () => void }) {
  return (
    <div className="vd-pila" style={{ gap: 10 }} role="alert">
      <div className="jg-error">No pudimos hablar con el simulador. {error}</div>
      {onReintentar && (
        <Button variant="white" onClick={onReintentar}>
          Reintentar
        </Button>
      )}
    </div>
  );
}

/** Algo que pasó en el año. Es la <Notification> del kit, con el texto completo en vez de cortado. */
export function Noticia({ titulo, texto, lado, className }: { titulo: string; texto: string; lado?: string; className?: string }) {
  return (
    <div className={cx("vd-noti", "jg-noti", className)}>
      <Avatar name={titulo} />
      <span className="vd-noti-texto">
        <span className="vd-noti-quien">{titulo}</span>
        <span className="vd-noti-msg">{texto}</span>
      </span>
      {lado && <span className="vd-noti-hora">{lado}</span>}
    </div>
  );
}
