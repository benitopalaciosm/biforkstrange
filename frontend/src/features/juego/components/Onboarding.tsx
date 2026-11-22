import "./onboarding.css";
import { useEffect, useRef, useState } from "react";
import {
  Button, ChevronLeftIcon, Chip, Heading, IconButton, Meta, Pill, Row, Screen, ScreenFooter, ScreenHeader, Segmented, Slider, Stack, Tag, Text,
} from "@/shared/ui";
import { ErrorApi, getPrompt, leerPerfil } from "../api";
import { EDUCACION, TIPO_EMPLEADOR, pesos } from "../textos";
import type { Catalogo, DudaSugerida, Perfil, PerfilLeido } from "../types";
import { ErrorCaja } from "./piezas";
import { PerfilForm, RUBROS_TOP, SLIDER_MAX, SLIDER_MIN, banda } from "./PerfilForm";

type Paso = "entrada" | "leyendo" | "tu" | "pega" | "plata";
/** Los pasos de cada camino: con CV se salta lo que el CV ya contestó. */
const MANUAL: Paso[] = ["tu", "pega", "plata"];
/** Las elecciones de cada tarjeta: parten vacías y hay que tocarlas para seguir. */
const ELEGIR: Record<string, (keyof Perfil)[]> = { tu: ["edu"], pega: ["tipo_empleador", "nivel", "rubro"], plata: ["ingles"] };
/** Los sliders siempre tienen un valor: cuentan como respuesta al pasar de tarjeta. */
const DESLIZAR: Record<string, (keyof Perfil)[]> = { tu: ["edad"], plata: ["sueldo"] };
const SITUACION: Record<string, string> = {
  independiente: "Independiente", fundador: "Fundador", buscando: "Buscando pega", estudiando: "Estudiando",
};
const FRASES = ["Leyendo tu experiencia…", "Buscando tu empresa en el SII…", "Contando tus años de pega…", "Eligiendo tus dudas…"];

/**
 * Onboarding en 3 pantallas: subes tu CV (o el PDF de LinkedIn) o contestas 3 tarjetas, después solo
 * lo que falta, y vas a tu duda. Arriba, la ficha de tu gemelo se arma con cada dato.
 * El formulario completo queda detrás de "Revisar todos mis datos".
 */
export function Onboarding({
  inicial,
  catalogo,
  errorCatalogo,
  onVolver,
  onListo,
  onElegirDuda,
  cargando = false,
  error = null,
}: {
  inicial: Perfil;
  catalogo: Catalogo | null;
  errorCatalogo: string | null;
  onVolver: () => void;
  onListo: (p: Perfil) => void;
  onElegirDuda: (p: Perfil, sugeridas: DudaSugerida[]) => void;
  cargando?: boolean;
  error?: string | null;
}) {
  const [p, setP] = useState<Perfil>(inicial);
  const [paso, setPaso] = useState<Paso>("entrada");
  /** Campos que ya sabemos de la persona (los que contestó o leyó Claude): esos aparecen en la ficha. */
  const [sabidos, setSabidos] = useState<ReadonlySet<string>>(new Set());
  const [faltan, setFaltan] = useState<Paso[]>(MANUAL);
  const [leido, setLeido] = useState<PerfilLeido | null>(null);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [completo, setCompleto] = useState(false);
  const [otroRubro, setOtroRubro] = useState(false);
  /** Lo que contó tu Claude o ChatGPT: se suma a lo del CV. */
  const [extra, setExtra] = useState<{ intereses: string[]; proyecto: string | null; retrato: string | null; sugeridas: DudaSugerida[] }>({
    intereses: [], proyecto: null, retrato: null, sugeridas: [],
  });
  const [conClaude, setConClaude] = useState(false);
  const [leyendoClaude, setLeyendoClaude] = useState(false);
  const [errorClaude, setErrorClaude] = useState<string | null>(null);
  const pedido = useRef(0);
  useEffect(() => () => void pedido.current++, []);

  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setSabidos((s) => new Set(s).add(k));
  };

  const leerPdf = async (pdf: string) => {
    const mio = ++pedido.current;
    setErrorLectura(null);
    setPaso("leyendo");
    try {
      const r = await leerPerfil({ pdf });
      if (mio !== pedido.current) return;
      const supuestos = new Set(r.supuestos.map((s) => s.campo));
      setP((x) => ({ ...x, ...r.perfil }));
      setLeido(r);
      setSabidos(new Set(Object.keys(r.perfil).filter((k) => !supuestos.has(k))));
      // el CV casi nunca dice el sueldo: esa pantalla va siempre; las otras, solo si falta algo
      const pasos: Paso[] = [];
      if (["edad", "edu"].some((c) => supuestos.has(c))) pasos.push("tu");
      if (["tipo_empleador", "nivel", "rubro"].some((c) => supuestos.has(c))) pasos.push("pega");
      pasos.push("plata");
      setFaltan(pasos);
      setPaso(pasos[0]);
    } catch (e) {
      if (mio !== pedido.current) return;
      setErrorLectura(e instanceof ErrorApi ? e.detalle : "No pudimos leer tu CV.");
      setPaso("entrada");
    }
  };

  /** Pega la respuesta de tu Claude: lo que dijo se suma a lo que ya sabíamos, sin pisarlo con valores por defecto. */
  const leerTuClaude = async (texto: string) => {
    setErrorClaude(null);
    setLeyendoClaude(true);
    try {
      const r = await leerPerfil(texto);
      const supuestos = new Set(r.supuestos.map((x) => x.campo));
      const dados = r.dados ?? Object.keys(r.perfil).filter((k) => !supuestos.has(k));
      const nuevos = Object.fromEntries(dados.map((k) => [k, r.perfil[k as keyof Perfil]])) as Partial<Perfil>;
      const perfil = { ...p, ...nuevos };
      const ahora = new Set([...sabidos, ...dados]);
      const sugeridas = [...(r.dudas_sugeridas ?? []), ...(leido?.dudas_sugeridas ?? [])]
        .filter((d, k, todas) => todas.findIndex((x) => x.decision === d.decision) === k)
        .slice(0, 3);
      setP(perfil);
      setSabidos(ahora);
      setExtra({ intereses: r.intereses ?? [], proyecto: r.proyecto ?? null, retrato: r.retrato ?? null, sugeridas });
      setConClaude(false);
      if (paso === "entrada") {
        // solo las tarjetas de lo que tu Claude no dijo; si dijo todo, directo a tus dudas
        const pasos = MANUAL.filter((x) => [...(ELEGIR[x] ?? []), ...(DESLIZAR[x] ?? [])].some((k) => !ahora.has(k)));
        if (pasos.length === 0) return onElegirDuda(perfil, sugeridas);
        setFaltan(pasos);
        setPaso(pasos[0]);
      }
    } catch (e) {
      setErrorClaude(e instanceof ErrorApi ? e.detalle : "No pudimos leer lo que pegaste.");
    } finally {
      setLeyendoClaude(false);
    }
  };
  const sugeridas = extra.sugeridas.length ? extra.sugeridas : leido?.dudas_sugeridas ?? [];
  const panelClaude = (
    <TuClaude abierto={conClaude} onAbrir={() => setConClaude(true)} leyendo={leyendoClaude} error={errorClaude} onTexto={(t) => void leerTuClaude(t)} />
  );

  if (completo) {
    return (
      <PerfilForm
        inicial={p}
        catalogo={catalogo}
        errorCatalogo={errorCatalogo}
        onVolver={() => setCompleto(false)}
        onListo={onListo}
        onElegirDuda={(perfil) => onElegirDuda(perfil, sugeridas)}
        cargando={cargando}
        error={error}
      />
    );
  }

  const i = faltan.indexOf(paso);
  const ultimo = i === faltan.length - 1;
  const atras = () => (i > 0 ? setPaso(faltan[i - 1]) : (setPaso("entrada"), setFaltan(MANUAL)));
  const siguiente = () => {
    setSabidos((s) => new Set([...s, ...(DESLIZAR[paso] ?? [])]));
    if (ultimo) onElegirDuda(p, sugeridas);
    else setPaso(faltan[i + 1]);
  };
  const elegido = (k: keyof Perfil) => sabidos.has(k);
  const faltaElegir = (ELEGIR[paso] ?? []).some((k) => !elegido(k));
  const ref = catalogo?.sueldos_ref?.find((f) => f.educacion === p.edu && f.banda === banda(p.edad));

  return (
    <Screen gap={18}>
      <ScreenHeader
        left={
          <IconButton label="Volver" onClick={paso === "entrada" || paso === "leyendo" ? onVolver : atras}>
            <ChevronLeftIcon />
          </IconButton>
        }
        right={
          i >= 0 ? (
            <div className="ob-puntos" aria-label={`Paso ${i + 1} de ${faltan.length}`}>
              {faltan.map((f, k) => (
                <i key={f} data-hecho={k <= i || undefined} />
              ))}
            </div>
          ) : (
            <Pill>Tu gemelo</Pill>
          )
        }
      />

      {paso !== "entrada" && (
        <Ficha p={p} sabidos={sabidos} catalogo={catalogo} retrato={extra.retrato ?? leido?.retrato ?? null} intereses={extra.intereses} proyecto={extra.proyecto} />
      )}

      {errorCatalogo && <ErrorCaja error={errorCatalogo} />}

      {paso === "entrada" && (
        <Entrada
          error={errorLectura}
          onPdf={(pdf) => void leerPdf(pdf)}
          onManual={() => {
            setFaltan(MANUAL);
            setPaso("tu");
          }}
          claude={panelClaude}
        />
      )}

      {paso === "leyendo" && <Leyendo />}

      {catalogo && paso === "tu" && (
        <Tarjeta key="tu" titulo="Primero, tú.">
          <Slider label="Edad" value={p.edad} min={18} max={50} onChange={(n) => set("edad", n)} display={`${p.edad} años`} />
          <Stack gap={8}>
            <span className="jg-etiqueta">Estudios terminados</span>
            <Row>
              {catalogo.educacion.map((e) => (
                <Chip key={e} pressed={elegido("edu") && p.edu === e} onToggle={() => set("edu", e)}>
                  {EDUCACION[e] ?? e}
                </Chip>
              ))}
            </Row>
          </Stack>
        </Tarjeta>
      )}

      {catalogo && paso === "pega" && (
        <Tarjeta key="pega" titulo="¿Dónde trabajas hoy?">
          <Row>
            {catalogo.tipos_empleador.map((t) => (
              <Chip key={t} pressed={elegido("tipo_empleador") && p.tipo_empleador === t} onToggle={() => set("tipo_empleador", t)}>
                {TIPO_EMPLEADOR[t] ?? t}
              </Chip>
            ))}
          </Row>
          <Stack gap={8}>
            <span className="jg-etiqueta">Tu cargo</span>
            <Row>
              {catalogo.niveles.map((n) => (
                <Chip key={n.nivel} pressed={elegido("nivel") && p.nivel === n.nivel} onToggle={() => set("nivel", n.nivel)}>
                  {n.nombre}
                </Chip>
              ))}
            </Row>
          </Stack>
          <Stack gap={8}>
            <span className="jg-etiqueta">Rubro</span>
            <Row>
              {RUBROS_TOP.filter((r) => catalogo.rubros.includes(r)).map((r) => (
                <Chip
                  key={r}
                  pressed={elegido("rubro") && p.rubro === r}
                  onToggle={() => {
                    set("rubro", r);
                    setOtroRubro(false);
                  }}
                >
                  {r}
                </Chip>
              ))}
              <Chip pressed={otroRubro} onToggle={() => setOtroRubro(true)}>
                Otro
              </Chip>
            </Row>
            {otroRubro && (
              <select
                className="jg-campo"
                aria-label="Otro rubro"
                value={elegido("rubro") && !RUBROS_TOP.includes(p.rubro) ? p.rubro : ""}
                onChange={(e) => set("rubro", e.target.value)}
              >
                <option value="" disabled>
                  Elige tu rubro
                </option>
                {catalogo.rubros
                  .filter((r) => !RUBROS_TOP.includes(r))
                  .map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
              </select>
            )}
          </Stack>
        </Tarjeta>
      )}

      {catalogo && paso === "plata" && (
        <Tarjeta key="plata" titulo={leido ? "Lo que un CV no dice." : "Lo último."}>
          {panelClaude}
          <Slider
            label="Te llega al mes (líquido)"
            value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, p.sueldo))}
            min={SLIDER_MIN}
            max={SLIDER_MAX}
            step={50_000}
            color="var(--dinero)"
            onChange={(n) => set("sueldo", n)}
            display={pesos(p.sueldo)}
          />
          {ref && (
            <Text size="sm">
              La mitad de la gente como tú gana menos de <strong>{pesos(ref.p50)}</strong>.
            </Text>
          )}
          <Stack gap={8}>
            <span className="jg-etiqueta">¿Podrías trabajar en inglés?</span>
            <Segmented<string>
              label="Inglés"
              value={elegido("ingles") ? String(p.ingles ?? 0) : ""}
              onChange={(v) => set("ingles", v === "1" ? 1 : 0)}
              options={[
                { value: "0", label: "No" },
                { value: "1", label: "Sí" },
              ]}
            />
          </Stack>
        </Tarjeta>
      )}

      {i >= 0 && (
        <ScreenFooter>
          {error && <ErrorCaja error={error} />}
          <Button onClick={siguiente} disabled={!catalogo || cargando || faltaElegir}>
            {ultimo ? (sugeridas.length ? "Ver mis dudas" : "Elegir mi duda") : "Siguiente"}
          </Button>
          <button type="button" className="ob-link" onClick={() => setCompleto(true)}>
            Revisar todos mis datos
          </button>
        </ScreenFooter>
      )}
    </Screen>
  );
}

/** Pantalla 1: el atajo del CV (con la animación de LinkedIn) o las tarjetas. */
function Entrada({ error, onPdf, onManual, claude }: { error: string | null; onPdf: (pdf: string) => void; onManual: () => void; claude: React.ReactNode }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [encima, setEncima] = useState(false);
  const [errorArchivo, setErrorArchivo] = useState<string | null>(null);

  const subir = (f: File | undefined) => {
    if (!f) return;
    setErrorArchivo(null);
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) return setErrorArchivo("Tiene que ser un PDF.");
    if (f.size > 10_000_000) return setErrorArchivo("El PDF pesa más de 10 MB.");
    const lector = new FileReader();
    lector.onload = () => typeof lector.result === "string" && onPdf(lector.result);
    lector.onerror = () => setErrorArchivo("No pudimos abrir el archivo.");
    lector.readAsDataURL(f);
  };

  return (
    <>
      <Stack gap={6} className="ob-entra">
        <Heading level={1}>Armemos a tu gemelo.</Heading>
        <Text>Con tu LinkedIn tarda 15 segundos.</Text>
      </Stack>

      <button
        type="button"
        className="ob-zona ob-entra"
        data-encima={encima || undefined}
        onClick={() => entrada.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          subir(e.dataTransfer.files?.[0]);
        }}
      >
        <LinkedinAPdf />
        <strong>Sube el PDF de tu LinkedIn o tu CV</strong>
        <span className="ob-chico">En LinkedIn, desde el computador: tu perfil → Recursos → Guardar como PDF</span>
      </button>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(e) => {
          subir(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {(errorArchivo || error) && (
        <div className="jg-error" role="alert">
          {errorArchivo ?? `No pudimos leer tu CV. ${error}`}
        </div>
      )}

      {claude}

      <button type="button" className="ob-link ob-entra" onClick={onManual}>
        Prefiero contestar 3 preguntas
      </button>
    </>
  );
}

/** La mini animación: el logo de LinkedIn suelta un PDF que vuela hasta tu gemelo. */
function LinkedinAPdf() {
  return (
    <div className="ob-anim" aria-hidden="true">
      <span className="ob-in">in</span>
      <span className="ob-via" />
      <span className="ob-pdf">
        <i />
        <i />
        <i />
      </span>
      <span className="ob-gemelo">
        <span />
      </span>
    </div>
  );
}

/** Mientras Claude lee: el documento escaneándose y frases que van cambiando. */
function Leyendo() {
  const [k, setK] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setK((x) => (x + 1) % FRASES.length), 2600);
    return () => window.clearInterval(t);
  }, []);
  return (
    <Stack gap={14} className="ob-leyendo">
      <div className="ob-hoja" aria-hidden="true">
        {Array.from({ length: 7 }, (_, n) => (
          <i key={n} style={{ width: `${55 + ((n * 37) % 40)}%` }} />
        ))}
        <span className="ob-scan" />
      </div>
      <Text role="status" key={k} className="ob-frase">
        {FRASES[k]}
      </Text>
    </Stack>
  );
}

/** La ficha de tu gemelo: cada dato que se sabe aparece con un pop. */
function Ficha({
  p, sabidos, catalogo, retrato, intereses = [], proyecto = null,
}: { p: Perfil; sabidos: ReadonlySet<string>; catalogo: Catalogo | null; retrato: string | null; intereses?: string[]; proyecto?: string | null }) {
  const nivel = catalogo?.niveles.find((n) => n.nivel === p.nivel)?.nombre;
  const datos: [string, string | undefined][] = [
    ["edad", `${p.edad} años`],
    ["edu", EDUCACION[p.edu] ?? p.edu],
    ["nivel", nivel],
    ["tipo_empleador", TIPO_EMPLEADOR[p.tipo_empleador] ?? p.tipo_empleador],
    ["rubro", p.rubro],
    ["sueldo", pesos(p.sueldo)],
    ["ingles", p.ingles ? "Inglés" : undefined],
    ["estado", p.estado && p.estado !== "empleado" ? SITUACION[p.estado] : undefined],
    ["remoto", p.remoto ? "Remoto" : undefined],
    ["parcial", p.parcial ? "Media jornada" : undefined],
    ["usa_ia", p.usa_ia ? "Usa IA" : undefined],
    ["rubro_sonado", p.rubro_sonado ? `Sueña con ${p.rubro_sonado}` : undefined],
    ["anos_por_empleo", p.anos_por_empleo ? `Se cambia cada ${p.anos_por_empleo.toLocaleString("es-CL")} años` : undefined],
  ];
  const visibles = datos.filter(([k, v]) => v && sabidos.has(k));
  return (
    <div className="ob-ficha">
      <div className="ob-avatar" data-lleno={Math.min(visibles.length, 7)} aria-hidden="true">
        <span />
      </div>
      <Stack gap={6}>
        <Meta>Tu gemelo</Meta>
        {retrato && <Text size="sm">«{retrato}»</Text>}
        <div className="ob-tags">
          {visibles.length === 0 && <span className="ob-chico">Se va armando con cada respuesta.</span>}
          {visibles.map(([k, v]) => (
            <Tag key={`${k}:${v}`} className="ob-tag">
              {v}
            </Tag>
          ))}
          {proyecto && (
            <Tag key={`proyecto:${proyecto}`} className="ob-tag ob-tag--tuyo">
              Proyecto: {proyecto.length > 40 ? `${proyecto.slice(0, 40)}…` : proyecto}
            </Tag>
          )}
          {intereses.map((x) => (
            <Tag key={`interes:${x}`} className="ob-tag ob-tag--tuyo">
              {x}
            </Tag>
          ))}
        </div>
      </Stack>
    </div>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <Stack gap={18} className="ob-tarjeta">
      <Heading level={2}>{titulo}</Heading>
      {children}
    </Stack>
  );
}

/**
 * Pregúntale a tu Claude o ChatGPT: te conoce mejor que tu CV (tus proyectos, lo que te apasiona).
 * Un toque copia el prompt y lo abre ya escrito; pegas la respuesta y se suma a tu gemelo.
 */
function TuClaude({
  abierto, onAbrir, leyendo, error, onTexto,
}: { abierto: boolean; onAbrir: () => void; leyendo: boolean; error: string | null; onTexto: (texto: string) => void }) {
  const [prompt, setPrompt] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [copiado, setCopiado] = useState(false);
  useEffect(() => {
    if (!abierto || prompt) return;
    let vivo = true;
    getPrompt()
      .then((r) => vivo && setPrompt(r.prompt))
      .catch(() => vivo && setPrompt(null));
    return () => {
      vivo = false;
    };
  }, [abierto, prompt]);

  if (!abierto) {
    return (
      <button type="button" className="ob-claude-abrir ob-entra" onClick={onAbrir}>
        <span className="ob-claude-chispa" aria-hidden="true">✦</span>
        <span>
          <strong>¿Usas Claude o ChatGPT?</strong> Que te describa él: sabe de tus proyectos y lo que te apasiona.
        </span>
      </button>
    );
  }

  const abrir = async (url: string) => {
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
    } catch {
      /* sin portapapeles: el link ya lleva el prompt escrito */
    }
    window.open(`${url}${encodeURIComponent(prompt)}`, "_blank", "noopener");
  };

  return (
    <Stack gap={10} className="ob-claude">
      <Text size="sm">
        <strong>1.</strong> Ábrelo con el prompt ya escrito. Tu Claude te muestra la respuesta y tú decides qué pegar: no le pedimos salud, pareja
        ni familia.
      </Text>
      <Row gap={8}>
        <Button variant="quiet" onClick={() => void abrir("https://claude.ai/new?q=")} disabled={!prompt}>
          Abrir Claude
        </Button>
        <Button variant="quiet" onClick={() => void abrir("https://chatgpt.com/?q=")} disabled={!prompt}>
          Abrir ChatGPT
        </Button>
      </Row>
      {copiado && <span className="ob-chico">También quedó copiado, por si no aparece escrito.</span>}
      <label className="ob-chico" htmlFor="ob-claude-texto">
        <strong>2.</strong> Pega aquí lo que te respondió
      </label>
      <textarea
        id="ob-claude-texto"
        className="jg-campo ob-claude-texto"
        rows={5}
        placeholder={"```gemelo-laboral\nsueldo_liquido: …"}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {error && (
        <div className="jg-error" role="alert">
          {error}
        </div>
      )}
      <Button onClick={() => onTexto(texto.trim())} disabled={!texto.trim() || leyendo}>
        {leyendo ? "Leyendo…" : "Sumar a mi gemelo"}
      </Button>
    </Stack>
  );
}
