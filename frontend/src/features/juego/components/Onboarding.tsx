import "./onboarding.css";
import { useEffect, useRef, useState } from "react";
import {
  Button, ChevronLeftIcon, Chip, Heading, IconButton, Meta, Pill, Row, Screen, ScreenFooter, ScreenHeader, Segmented, Slider, Stack, Tag, Text,
} from "@/shared/ui";
import { ErrorApi, getPrompt, leerPerfil } from "../api";
import { EDUCACION, TIPO_EMPLEADOR, pesos } from "../textos";
import type { Catalogo, DudaSugerida, Perfil, PerfilLeido } from "../types";
import { ErrorCaja } from "./piezas";
import { Prueba } from "./Prueba";
import { PerfilForm, RUBROS_TOP, SLIDER_MAX, SLIDER_MIN, banda } from "./PerfilForm";

type Paso = "entrada" | "leyendo" | "tu" | "pega" | "plata" | "prueba";
/** Los pasos de cada camino: con CV se salta lo que el CV ya contestó. */
const MANUAL: Paso[] = ["tu", "pega", "plata", "prueba"];
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
  const pedido = useRef(0);
  useEffect(() => () => void pedido.current++, []);

  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => {
    setP((x) => ({ ...x, [k]: v }));
    setSabidos((s) => new Set(s).add(k));
  };

  useEffect(() => {
    // si ya armaste tu gemelo en /gemelo, el juego lo usa de partida (se puede apagar)
    const id = gemeloGuardado();
    if (id && inicial.gemelo_id === undefined) setP((x) => ({ ...x, gemelo_id: id }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leer = async (entrada: { pdf: string } | { relato: string }) => {
    const mio = ++pedido.current;
    setErrorLectura(null);
    setPaso("leyendo");
    try {
      const r = await leerPerfil("pdf" in entrada ? { pdf: entrada.pdf } : entrada.relato);
      if (mio !== pedido.current) return;
      const supuestos = new Set(r.supuestos.map((s) => s.campo));
      setP((x) => ({ ...x, ...r.perfil, ...("relato" in entrada ? { relato: entrada.relato } : {}) }));
      setLeido(r);
      setSabidos(new Set(Object.keys(r.perfil).filter((k) => !supuestos.has(k))));
      // el CV casi nunca dice el sueldo: esa pantalla va siempre; las otras, solo si falta algo
      const pasos: Paso[] = [];
      if (["edad", "edu"].some((c) => supuestos.has(c))) pasos.push("tu");
      if (["tipo_empleador", "nivel", "rubro"].some((c) => supuestos.has(c))) pasos.push("pega");
      pasos.push("plata", "prueba"); // al final, tu gemelo se pone a prueba
      setFaltan(pasos);
      setPaso(pasos[0]);
    } catch (e) {
      if (mio !== pedido.current) return;
      setErrorLectura(e instanceof ErrorApi ? e.detalle : "No pudimos leer lo que nos diste.");
      setPaso("entrada");
    }
  };

  if (completo) {
    return (
      <PerfilForm
        inicial={p}
        catalogo={catalogo}
        errorCatalogo={errorCatalogo}
        onVolver={() => setCompleto(false)}
        onListo={onListo}
        onElegirDuda={(perfil) => onElegirDuda(perfil, leido?.dudas_sugeridas ?? [])}
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
    if (ultimo) onElegirDuda(p, leido?.dudas_sugeridas ?? []);
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

      {paso !== "entrada" && <Ficha p={p} sabidos={sabidos} catalogo={catalogo} retrato={leido?.retrato ?? null} />}

      {errorCatalogo && <ErrorCaja error={errorCatalogo} />}

      {paso === "entrada" && (
        <Entrada
          error={errorLectura}
          gemeloId={p.gemelo_id ?? null}
          onGemelo={(id) => setP((x) => ({ ...x, gemelo_id: id }))}
          onRelato={(relato) => void leer({ relato })}
          onPdf={(pdf) => void leer({ pdf })}
          onManual={() => {
            setFaltan(MANUAL);
            setPaso("tu");
          }}
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

      {paso === "prueba" && <Prueba perfil={p} onGemelo={(id) => setP((x) => ({ ...x, gemelo_id: id }))} />}

      {i >= 0 && (
        <ScreenFooter>
          {error && <ErrorCaja error={error} />}
          <Button onClick={siguiente} disabled={!catalogo || cargando || faltaElegir}>
            {ultimo ? (leido?.dudas_sugeridas?.length ? "Ver mis dudas" : "Elegir mi duda") : "Siguiente"}
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
const CLAVE_GEMELO = "biforkstrange.twinProfileId"; // la misma que usa /gemelo

function gemeloGuardado(): string | null {
  try {
    return localStorage.getItem(CLAVE_GEMELO);
  } catch {
    return null;
  }
}

/** Lo que se suma al prompt del equipo: el relato libre que usa el narrador para contar tus cartas. */
const PROMPT_RELATO = `

4. Después del bloque, agrega una sección "## Sobre mí, en mis palabras" escrita en primera persona, como si yo me presentara (150–300 palabras), con lo que sabes de mí:
- Qué hago, dónde y desde cuándo; qué me gusta y qué me cansa de mi pega.
- Cómo decido: frente al riesgo, la plata, la estabilidad, los cambios.
- Cómo soy trabajando con otras personas, qué me da energía y qué me la quita.
- Lo que me importa fuera del trabajo y las personas que pesan en mis decisiones (sin datos de salud ni de terceros).
- Las dudas o planes que tengo hoy.
Solo lo que sabes de verdad; si algo no lo sabes, no lo inventes.`;

/** Si la API no responde, un prompt corto que igual sirve para el relato. */
const PROMPT_RESPALDO = `Quiero que me presentes para un simulador de decisiones de carrera. Con lo que sabes de mí por nuestras conversaciones y tus memorias, escribe en primera persona, como si yo me presentara (150–300 palabras): mi edad, estudios, qué hago y dónde, más o menos cuánto gano, cómo decido frente al riesgo y los cambios, qué me importa fuera del trabajo y qué duda de carrera tengo hoy. Solo lo que sabes de verdad; si te falta algo importante, pregúntamelo antes. Sin datos de salud ni de terceros.`;

function PromptAgente() {
  const [estado, setEstado] = useState<"" | "cargando" | "copiado" | "error">("");
  const [texto, setTexto] = useState<string | null>(null);

  const armar = async () => {
    if (texto) return texto;
    let t: string;
    try {
      t = (await getPrompt()).prompt + PROMPT_RELATO;
    } catch {
      t = PROMPT_RESPALDO;
    }
    setTexto(t);
    return t;
  };

  const copiar = async () => {
    setEstado("cargando");
    const t = await armar();
    try {
      await navigator.clipboard.writeText(t);
      setEstado("copiado");
      setTimeout(() => setEstado(""), 2500);
    } catch {
      setEstado("error"); // sin permiso de portapapeles: se muestra para copiarlo a mano
    }
  };

  return (
    <div className="ob-agente">
      <div className="ob-agente-fila">
        <span>
          <strong>¿Usas Claude, ChatGPT u otra IA?</strong> Ya te conoce: copia este prompt, pégaselo y trae acá lo que te responda.
        </span>
        <Button variant="white" onClick={() => void copiar()} disabled={estado === "cargando"}>
          {estado === "copiado" ? "Copiado" : estado === "cargando" ? "Armando…" : "Copiar prompt"}
        </Button>
      </div>
      <details onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && void armar()}>
        <summary>Ver el prompt</summary>
        {estado === "error" && <span className="ob-chico">No pudimos copiarlo solo: selecciónalo y cópialo a mano.</span>}
        <pre>{texto ?? "Cargando…"}</pre>
      </details>
    </div>
  );
}

const PISTAS = [
  "Qué haces y dónde",
  "Qué te gusta y qué te cansa de tu pega",
  "Cómo decides: ¿te tira lo seguro o lo nuevo?",
  "Qué te importa fuera del trabajo",
  "Qué duda tienes hoy",
];

function Entrada({
  error, gemeloId, onGemelo, onRelato, onPdf, onManual,
}: {
  error: string | null;
  gemeloId: string | null;
  onGemelo: (id: string | null) => void;
  onRelato: (relato: string) => void;
  onPdf: (pdf: string) => void;
  onManual: () => void;
}) {
  const [relato, setRelato] = useState("");
  const guardado = gemeloGuardado();
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
        <Text>Cuéntanos de ti como tú quieras. Con eso elegimos las preguntas y contamos cada escenario a tu medida.</Text>
      </Stack>

      <div className="ob-relato ob-entra">
        <PromptAgente />
        <textarea
          className="ob-relato-texto"
          value={relato}
          maxLength={20000}
          placeholder="Ej: Tengo 29, soy ingeniera de datos en una fintech. Me encanta resolver problemas pero las reuniones me drenan. Me tienta irme afuera, aunque mi mamá está sola en Concepción…"
          onChange={(e) => setRelato(e.target.value)}
        />
        <div className="ob-pistas">
          {PISTAS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <Button onClick={() => onRelato(relato.trim())} disabled={relato.trim().length < 40}>
          Seguir con esto
        </Button>
      </div>

      <div className="ob-gemelo ob-entra">
        {guardado ? (
          <label>
            <input type="checkbox" checked={gemeloId === guardado} onChange={(e) => onGemelo(e.target.checked ? guardado : null)} />
            <span>
              <strong>Usar mi gemelo digital.</strong> Sus rasgos afinados deciden qué cartas te salen más.{" "}
              <a href="/gemelo" target="_blank" rel="noreferrer">Afinarlo</a>
            </span>
          </label>
        ) : (
          <span className="ob-chico">
            ¿Quieres que las cartas sigan tu personalidad? <a href="/gemelo" target="_blank" rel="noreferrer">Arma tu gemelo digital</a> con unas preguntas y vuelve.
          </span>
        )}
      </div>

      <div className="ob-o ob-entra"><span>o</span></div>

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
          {errorArchivo ?? `No pudimos leer lo que nos diste. ${error}`}
        </div>
      )}

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
function Ficha({ p, sabidos, catalogo, retrato }: { p: Perfil; sabidos: ReadonlySet<string>; catalogo: Catalogo | null; retrato: string | null }) {
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
