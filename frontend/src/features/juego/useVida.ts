import { useEffect, useRef, useState } from "react";
import { api } from "@/shared/api";
import type { AnioNarrado, Caso, Identidad, Perfil, Prioridades, Turno } from "@/shared/types";
import { anioDe, plantilla } from "./comun";

type Params = {
  perfil: Perfil;
  prioridades: Prioridades;
  identidad: Identidad;
  mundo: string;
  mundoNombre: string;
  semilla: number;
  conClaude: boolean;
};

/**
 * Una vida en juego. El motor la recalcula entera con cada elección (es determinista dada la
 * semilla). Los años que se van cerrando entran a una cola para mostrarse uno a uno.
 * Claude cuenta cada año y escribe la próxima carta; nunca se espera: la plantilla sale altiro.
 */
export function useVida(p: Params) {
  const [elecciones, setElecciones] = useState<string[]>([]);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [cola, setCola] = useState<number[]>([]);
  const [narrados, setNarrados] = useState<Record<number, AnioNarrado>>({});
  const [casos, setCasos] = useState<Record<number, Caso>>({});
  const [escribiendo, setEscribiendo] = useState(0);
  const cerrados = useRef(0);
  const enCurso = useRef(false); // una sola elección por turno, aunque toquen dos veces
  const narradosRef = useRef<Record<number, AnioNarrado>>({});

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    const n = elecciones.length;
    api
      .turno({ perfil: p.perfil, prioridades: p.prioridades, identidad: p.identidad, mundo: p.mundo, semilla: p.semilla, elecciones })
      .then((t) => {
        if (!vigente) return;
        enCurso.current = false;
        const nuevos = t.anios.slice(cerrados.current);
        cerrados.current = t.anios.length;
        setTurno(t);
        setCola((c) => [...c, ...nuevos.map((a) => a.t)]);
        if (!p.conClaude) return;
        const pedidos = nuevos.length ? nuevos.map((a, i) => ({ anio: a, pendiente: i === nuevos.length - 1 ? t.pendiente : null })) : t.pendiente ? [{ anio: null, pendiente: t.pendiente }] : [];
        for (const pedido of pedidos) {
          const previa = t.anios
            .filter((a) => !pedido.anio || a.t < pedido.anio.t)
            .slice(-8)
            .map((a) => `${anioDe(a.t)}: ${narradosRef.current[a.t]?.relato ?? plantilla(a).relato}`);
          setEscribiendo((x) => x + 1);
          api
            .historia({ perfil: p.perfil, identidad: p.identidad, mundo: p.mundoNombre, historia_previa: previa, ...pedido })
            .then((h) => {
              if (pedido.anio && h.anio) {
                narradosRef.current[pedido.anio.t] = h.anio;
                setNarrados((x) => ({ ...x, [pedido.anio!.t]: h.anio! }));
              }
              if (pedido.pendiente && h.caso) setCasos((x) => ({ ...x, [n]: h.caso! }));
            })
            .catch(() => undefined)
            .finally(() => setEscribiendo((x) => x - 1));
        }
      })
      .catch((e) => {
        enCurso.current = false;
        if (vigente) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
    // La vida se recalcula con cada elección nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elecciones]);

  return {
    turno,
    elecciones,
    cargando,
    error,
    cola,
    narrados,
    caso: casos[elecciones.length],
    escribiendo: escribiendo > 0,
    elegir: (id: string) => {
      if (enCurso.current || !turno?.pendiente?.opciones.some((o) => o.id === id)) return;
      enCurso.current = true;
      setCargando(true);
      setElecciones((e) => [...e, id]);
    },
    avanzar: () => setCola((c) => c.slice(1)),
    reintentar: () => setElecciones((e) => [...e]),
    historia: () => (turno?.anios ?? []).map((a) => `${anioDe(a.t)}: ${narradosRef.current[a.t]?.relato ?? plantilla(a).relato}`),
  };
}
