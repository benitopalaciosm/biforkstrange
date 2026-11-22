import { useCallback, useRef, useState } from "react";
import { ErrorApi, leerPerfil } from "../api";
import type { DudaSugerida, Perfil, PerfilLeido } from "../types";

/** Las pantallas del onboarding: tus fuentes y las tarjetas de preguntas. */
export type Paso = "entrada" | "tu" | "pega" | "plata";
/** Las tarjetas de preguntas, en orden. Con fuentes se salta lo que ya dijeron. */
export const MANUAL: Paso[] = ["tu", "pega", "plata"];

/** De dónde salió cada dato del perfil: lo contestaste tú, lo leyó Claude de tu CV o lo contó tu Claude. */
export type Fuente = "tu" | "cv" | "claude";

/** Lo que contó tu Claude o ChatGPT además del perfil. */
export type LoDeTuClaude = { intereses: string[]; proyecto: string | null; retrato: string | null; sugeridas: DudaSugerida[] };

/**
 * El perfil a medio armar en el onboarding. Vive en la partida (no en la pantalla) para que volver desde
 * las dudas lo encuentre igual: lo que contestaste, lo que leyó Claude y en qué tarjeta ibas.
 */
export type Borrador = {
  perfil: Perfil;
  /**
   * Campos que ya sabemos de la persona y de dónde salieron: esos aparecen en la ficha. Lo que contestaste tú
   * no lo pisa nadie; lo que contó tu Claude pisa al CV; el CV solo llena lo que nadie dijo.
   */
  fuentes: Record<string, Fuente>;
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
  perfil, fuentes: {}, leido: null, claude: null, paso: "entrada", faltan: MANUAL, completo: false,
});

/** El onboarding: el borrador y las dos lecturas de Claude (tu CV y lo que pegas de tu Claude). */
export function useBorrador(inicial: Borrador) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const [leyendoCv, setLeyendoCv] = useState(false);
  const [errorCv, setErrorCv] = useState<string | null>(null);
  const [leyendoClaude, setLeyendoClaude] = useState(false);
  const [errorClaude, setErrorClaude] = useState<string | null>(null);
  /** Un contador por fuente: solo la última lectura de cada una se usa, llegue en el orden que llegue. */
  const pedidoCv = useRef(0);
  const pedidoClaude = useRef(0);

  const set = useCallback(<K extends keyof Perfil>(k: K, v: Perfil[K]) => {
    setBorrador((b) => ({ ...b, perfil: { ...b.perfil, [k]: v }, fuentes: { ...b.fuentes, [k]: "tu" } }));
  }, []);

  /** Marca como respondidos campos que ya tienen valor (los sliders siempre tienen uno). */
  const marcar = useCallback((campos: string[]) => {
    setBorrador((b) => ({ ...b, fuentes: { ...Object.fromEntries(campos.map((k) => [k, "tu" as const])), ...b.fuentes } }));
  }, []);

  const irA = useCallback((paso: Paso, faltan?: Paso[]) => {
    setBorrador((b) => ({ ...b, paso, faltan: faltan ?? b.faltan }));
  }, []);

  const verCompleto = useCallback((completo: boolean) => setBorrador((b) => ({ ...b, completo })), []);

  /** Si alguna lectura estaba en curso, su respuesta ya no se usa. */
  const soltarLecturas = useCallback(() => {
    pedidoCv.current++;
    pedidoClaude.current++;
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
    const mio = ++pedidoCv.current;
    setErrorCv(null);
    setLeyendoCv(true);
    try {
      const r = await leerPerfil({ pdf });
      if (mio !== pedidoCv.current) return;
      const supuestos = new Set(r.supuestos.map((s) => s.campo));
      // sobre el borrador de ahora, no el de cuando se subió: tu Claude pudo llegar mientras tanto
      setBorrador((b) => {
        // lo que contestaste o contó tu Claude manda; el CV llena el resto (o reemplaza a un CV anterior)
        const delCv = Object.keys(r.perfil).filter((k) => !supuestos.has(k) && (b.fuentes[k] ?? "cv") === "cv");
        return {
          ...b,
          perfil: { ...b.perfil, ...Object.fromEntries(delCv.map((k) => [k, r.perfil[k as keyof Perfil]])) },
          fuentes: { ...b.fuentes, ...Object.fromEntries(delCv.map((k) => [k, "cv" as const])) },
          leido: r,
        };
      });
    } catch (e) {
      if (mio !== pedidoCv.current) return;
      setErrorCv(e instanceof ErrorApi ? e.detalle : "No pudimos leer tu CV.");
    } finally {
      if (mio === pedidoCv.current) setLeyendoCv(false);
    }
  }, []);

  /** Pega la respuesta de tu Claude: lo que dijo se suma a lo que ya sabíamos, sin pisarlo con valores por defecto. */
  const leerTuClaude = useCallback(async (texto: string) => {
    const mio = ++pedidoClaude.current;
    setErrorClaude(null);
    setLeyendoClaude(true);
    try {
      const r = await leerPerfil(texto);
      if (mio !== pedidoClaude.current) return false;
      const supuestos = new Set(r.supuestos.map((x) => x.campo));
      const dados = r.dados ?? Object.keys(r.perfil).filter((k) => !supuestos.has(k));
      setBorrador((b) => {
        // tu Claude pisa lo que leyó el CV, pero no lo que contestaste tú
        const suyos = dados.filter((k) => b.fuentes[k] !== "tu");
        return {
          ...b,
          perfil: { ...b.perfil, ...Object.fromEntries(suyos.map((k) => [k, r.perfil[k as keyof Perfil]])) },
          fuentes: { ...b.fuentes, ...Object.fromEntries(suyos.map((k) => [k, "claude" as const])) },
          claude: { intereses: r.intereses ?? [], proyecto: r.proyecto ?? null, retrato: r.retrato ?? null, sugeridas: r.dudas_sugeridas ?? [] },
        };
      });
      return true;
    } catch (e) {
      if (mio !== pedidoClaude.current) return false;
      setErrorClaude(e instanceof ErrorApi ? e.detalle : "No pudimos leer lo que pegaste.");
      return false;
    } finally {
      if (mio === pedidoClaude.current) setLeyendoClaude(false);
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
