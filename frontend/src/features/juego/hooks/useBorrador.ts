import { useCallback, useRef, useState } from "react";
import { ErrorApi, leerPerfil } from "../api";
import type { DudaSugerida, Perfil, PerfilLeido } from "../types";

/** Las pantallas del onboarding: tus fuentes y las tarjetas de preguntas. */
export type Paso = "entrada" | "tu" | "pega" | "plata";
/** Las tarjetas de preguntas, en orden. Con fuentes se salta lo que ya dijeron. */
export const MANUAL: Paso[] = ["tu", "pega", "plata"];

/** Lo que contó tu Claude o ChatGPT además del perfil. */
export type LoDeTuClaude = { intereses: string[]; proyecto: string | null; retrato: string | null; sugeridas: DudaSugerida[] };

/**
 * El perfil a medio armar en el onboarding. Vive en la partida (no en la pantalla) para que volver desde
 * las dudas lo encuentre igual: lo que contestaste, lo que leyó Claude y en qué tarjeta ibas.
 */
export type Borrador = {
  perfil: Perfil;
  /** Campos que ya sabemos de la persona (los que contestó o leyó Claude): esos aparecen en la ficha. */
  sabidos: string[];
  /** Lo que leyó Claude de tu LinkedIn o CV. */
  leido: PerfilLeido | null;
  /** Lo que contó tu Claude. */
  claude: LoDeTuClaude | null;
  paso: Paso;
  /** Las tarjetas que tocan en este camino. */
  faltan: Paso[];
  /** El formulario completo ("Revisar todos mis datos") abierto. */
  completo: boolean;
};

export const borradorInicial = (perfil: Perfil): Borrador => ({
  perfil, sabidos: [], leido: null, claude: null, paso: "entrada", faltan: MANUAL, completo: false,
});

/** El onboarding: el borrador y las dos lecturas de Claude (tu CV y lo que pegas de tu Claude). */
export function useBorrador(inicial: Borrador) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const [leyendoCv, setLeyendoCv] = useState(false);
  const [errorCv, setErrorCv] = useState<string | null>(null);
  const [leyendoClaude, setLeyendoClaude] = useState(false);
  const [errorClaude, setErrorClaude] = useState<string | null>(null);
  const pedido = useRef(0);

  const set = useCallback(<K extends keyof Perfil>(k: K, v: Perfil[K]) => {
    setBorrador((b) => ({ ...b, perfil: { ...b.perfil, [k]: v }, sabidos: b.sabidos.includes(k) ? b.sabidos : [...b.sabidos, k] }));
  }, []);

  /** Marca como respondidos campos que ya tienen valor (los sliders siempre tienen uno). */
  const marcar = useCallback((campos: string[]) => {
    setBorrador((b) => ({ ...b, sabidos: [...new Set([...b.sabidos, ...campos])] }));
  }, []);

  const irA = useCallback((paso: Paso, faltan?: Paso[]) => {
    setBorrador((b) => ({ ...b, paso, faltan: faltan ?? b.faltan }));
  }, []);

  const verCompleto = useCallback((completo: boolean) => setBorrador((b) => ({ ...b, completo })), []);

  /** Si alguna lectura estaba en curso, su respuesta ya no se usa. */
  const soltarLecturas = useCallback(() => {
    pedido.current++;
    setLeyendoCv(false);
    setLeyendoClaude(false);
  }, []);

  const reiniciar = useCallback((perfil: Perfil) => {
    soltarLecturas();
    setErrorCv(null);
    setErrorClaude(null);
    setBorrador(borradorInicial(perfil));
  }, [soltarLecturas]);

  const leerPdf = useCallback(async (pdf: string) => {
    const mio = ++pedido.current;
    setErrorCv(null);
    setLeyendoCv(true);
    try {
      const r = await leerPerfil({ pdf });
      if (mio !== pedido.current) return;
      const supuestos = new Set(r.supuestos.map((s) => s.campo));
      setBorrador((b) => {
        // lo que ya contó tu Claude manda; el CV llena el resto
        const delCv = Object.keys(r.perfil).filter((k) => !supuestos.has(k) && !b.sabidos.includes(k));
        return {
          ...b,
          perfil: { ...b.perfil, ...Object.fromEntries(delCv.map((k) => [k, r.perfil[k as keyof Perfil]])) },
          sabidos: [...new Set([...b.sabidos, ...delCv])],
          leido: r,
        };
      });
    } catch (e) {
      if (mio !== pedido.current) return;
      setErrorCv(e instanceof ErrorApi ? e.detalle : "No pudimos leer tu CV.");
    } finally {
      if (mio === pedido.current) setLeyendoCv(false);
    }
  }, []);

  /** Pega la respuesta de tu Claude: lo que dijo se suma a lo que ya sabíamos, sin pisarlo con valores por defecto. */
  const leerTuClaude = useCallback(async (texto: string) => {
    setErrorClaude(null);
    setLeyendoClaude(true);
    try {
      const r = await leerPerfil(texto);
      const supuestos = new Set(r.supuestos.map((x) => x.campo));
      const dados = r.dados ?? Object.keys(r.perfil).filter((k) => !supuestos.has(k));
      const nuevos = Object.fromEntries(dados.map((k) => [k, r.perfil[k as keyof Perfil]])) as Partial<Perfil>;
      setBorrador((b) => ({
        ...b,
        perfil: { ...b.perfil, ...nuevos },
        sabidos: [...new Set([...b.sabidos, ...dados])],
        claude: { intereses: r.intereses ?? [], proyecto: r.proyecto ?? null, retrato: r.retrato ?? null, sugeridas: r.dudas_sugeridas ?? [] },
      }));
      return true;
    } catch (e) {
      setErrorClaude(e instanceof ErrorApi ? e.detalle : "No pudimos leer lo que pegaste.");
      return false;
    } finally {
      setLeyendoClaude(false);
    }
  }, []);

  /** Las dudas que te sugieren tus fuentes: primero las de tu Claude, después las del CV, sin repetir. */
  const sugeridas = [...(borrador.claude?.sugeridas ?? []), ...(borrador.leido?.dudas_sugeridas ?? [])]
    .filter((d, k, todas) => todas.findIndex((x) => x.decision === d.decision) === k)
    .slice(0, 3);

  return {
    borrador, sugeridas, leyendoCv, errorCv, leyendoClaude, errorClaude,
    set, marcar, irA, verCompleto, soltarLecturas, reiniciar, leerPdf, leerTuClaude,
  };
}

export type Onboarding = ReturnType<typeof useBorrador>;
