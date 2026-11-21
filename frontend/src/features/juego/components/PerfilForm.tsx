import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Button, ChevronLeftIcon, Chip, Heading, IconButton, Panel, Pill, Row, Screen, ScreenFooter, ScreenHeader, Segmented, Slider, Stack, Tag, Text,
} from "@/shared/ui";
import { ErrorApi, leerPerfil } from "../api";
import { EDUCACION, TIPO_EMPLEADOR, pesos, riesgoEnPalabras } from "../textos";
import type { Catalogo, Perfil, Sexo } from "../types";
import { Cargando, ErrorCaja } from "./piezas";
import { Trayectoria, type EstadoLectura } from "./Trayectoria";

const SUELDO_MAX = 30_000_000;
/** Marca de un campo que el texto de la persona no decía y quedó con un valor por defecto. */
function Revisa({ si }: { si: boolean }) {
  return si ? (
    <Tag tone="sol" className="jg-revisa">
      No lo decía tu texto, revísalo
    </Tag>
  ) : null;
}

const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tu perfil: los 9 campos. Viene de la pantalla "2 · Sobre ti" del kit. */
export function PerfilForm({
  inicial,
  catalogo,
  errorCatalogo,
  onVolver,
  onListo,
}: {
  inicial: Perfil;
  catalogo: Catalogo | null;
  errorCatalogo: string | null;
  onVolver: () => void;
  onListo: (p: Perfil, dudaSugerida: string | null) => void;
}) {
  const [p, setP] = useState<Perfil>(inicial);
  const [busca, setBusca] = useState("");
  const idCarrera = useId();
  const idRubro = useId();
  const idSueldo = useId();
  const [lectura, setLectura] = useState<EstadoLectura>({ fase: "nada" });
  /** La duda que trajo el documento de tu Claude: se propone en la pantalla siguiente. */
  const [dudaSugerida, setDudaSugerida] = useState<string | null>(null);
  /** Campos con valor por defecto que la persona todavía no revisa. */
  const [marcados, setMarcados] = useState<ReadonlySet<string>>(new Set());
  /** Campos que la persona tocó desde que le pidió a Claude leer: esos no se pisan cuando llega la respuesta. */
  const tocados = useRef(new Set<string>());
  const pedido = useRef(0);
  useEffect(() => () => void pedido.current++, []);

  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => {
    tocados.current.add(k);
    setMarcados((m) => (m.has(k) ? new Set([...m].filter((x) => x !== k)) : m));
    setP((x) => ({ ...x, [k]: v }));
  };
  const marca = (k: keyof Perfil) => (marcados.has(k) ? "jg-marcado" : undefined);

  const llenarConClaude = async (texto: string) => {
    const mio = ++pedido.current;
    tocados.current = new Set();
    setLectura({ fase: "leyendo", documento: texto.includes("```gemelo-laboral") });
    try {
      const r = await leerPerfil(texto);
      if (mio !== pedido.current) return;
      // lo que la persona editó mientras Claude leía se respeta
      const nuevos = Object.fromEntries(Object.entries(r.perfil).filter(([k]) => !tocados.current.has(k))) as Partial<Perfil>;
      const pendientes = r.supuestos.filter((x) => !tocados.current.has(x.campo));
      setP((x) => ({ ...x, ...nuevos }));
      setBusca("");
      setMarcados(new Set(pendientes.map((x) => x.campo)));
      setDudaSugerida(r.duda);
      setLectura({
        fase: "listo", inferido: r.inferido, supuestos: pendientes.map((x) => x.nombre), avisos: r.avisos ?? [],
        documento: r.via === "documento", duda: r.duda,
      });
    } catch (e) {
      if (mio !== pedido.current) return;
      const err = e instanceof ErrorApi ? e : new ErrorApi(0, e instanceof Error ? e.message : String(e));
      setLectura({ fase: "error", status: err.status, detalle: err.detalle });
    }
  };

  const carrera = catalogo?.carreras.find((c) => c.carrera_id === p.carrera_id);
  const encontradas = useMemo(() => {
    const q = sinTildes(busca.trim());
    if (!catalogo || q.length < 2) return [];
    return catalogo.carreras.filter((c) => sinTildes(`${c.carrera} ${c.area} ${c.tipo_institucion}`).includes(q)).slice(0, 8);
  }, [catalogo, busca]);

  const sueldoValido = p.sueldo > 0 && p.sueldo <= SUELDO_MAX;

  return (
    <Screen>
      <ScreenHeader
        left={
          <IconButton label="Volver al inicio" onClick={onVolver}>
            <ChevronLeftIcon />
          </IconButton>
        }
        right={<Pill>Tu perfil</Pill>}
      />
      <Stack>
        <Heading level={1}>Cuéntanos de ti.</Heading>
        <Text>Con esto armamos a tus gemelos: gente como tú, en tu misma situación. Las decisiones las tomas tú.</Text>
      </Stack>

      {errorCatalogo && <ErrorCaja error={errorCatalogo} />}
      {!catalogo && !errorCatalogo && <Cargando>Cargando alternativas…</Cargando>}

      <Trayectoria estado={lectura} onLlenar={(t) => void llenarConClaude(t)} />

      {catalogo && (
        <>
          <Stack gap={6} className={marca("edad")}>
            <Revisa si={marcados.has("edad")} />
            <Slider label="Edad" value={p.edad} min={18} max={50} onChange={(n) => set("edad", n)} display={`${p.edad} años`} />
          </Stack>

          <Stack as="section" className={marca("sexo")}>
            <span className="jg-etiqueta">Sexo</span>
            <Revisa si={marcados.has("sexo")} />
            <Segmented<Sexo>
              label="Sexo"
              value={p.sexo}
              onChange={(s) => set("sexo", s)}
              options={[
                { value: "m", label: "Mujer" },
                { value: "h", label: "Hombre" },
              ]}
            />
          </Stack>

          <Stack as="section" className={marca("edu")}>
            <span className="jg-etiqueta">Estudios terminados</span>
            <Revisa si={marcados.has("edu")} />
            <Row>
              {catalogo.educacion.map((e) => (
                <Chip key={e} pressed={p.edu === e} onToggle={() => set("edu", e)}>
                  {EDUCACION[e] ?? e}
                </Chip>
              ))}
            </Row>
          </Stack>

          <Panel>
            <Stack gap={4}>
              <label htmlFor={idCarrera} className="vd-h3">
                Tu carrera <span className="jg-chico">(opcional)</span>
              </label>
              <Text size="sm">Si la encuentras, usamos lo que ganan sus titulados.</Text>
            </Stack>
            {carrera ? (
              <Row style={{ alignItems: "center" }}>
                <Chip pressed onToggle={() => set("carrera_id", -1)}>
                  {carrera.carrera} · {carrera.tipo_institucion} ✕
                </Chip>
              </Row>
            ) : (
              <>
                <input
                  id={idCarrera}
                  className="jg-campo"
                  type="search"
                  placeholder="Busca entre las 252: enfermería, ingeniería civil…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                />
                {encontradas.length > 0 && (
                  <div className="jg-resultados">
                    {encontradas.map((c) => (
                      <button
                        key={c.carrera_id}
                        type="button"
                        onClick={() => {
                          set("carrera_id", c.carrera_id);
                          setBusca("");
                        }}
                      >
                        {c.carrera}
                        <small>
                          {c.tipo_institucion} · {c.area}
                        </small>
                      </button>
                    ))}
                  </div>
                )}
                {busca.trim().length >= 2 && encontradas.length === 0 && <Text size="sm">No está en la lista. Puedes seguir sin carrera.</Text>}
              </>
            )}
          </Panel>

          <Stack as="section" className={marca("rubro")}>
            <label htmlFor={idRubro} className="jg-etiqueta">
              Rubro
            </label>
            <Revisa si={marcados.has("rubro")} />
            <select id={idRubro} className="jg-campo" value={p.rubro} onChange={(e) => set("rubro", e.target.value)}>
              {catalogo.rubros.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Stack>

          <Stack as="section" className={marca("tipo_empleador")}>
            <span className="jg-etiqueta">Tipo de empresa</span>
            <Revisa si={marcados.has("tipo_empleador")} />
            <Row>
              {catalogo.tipos_empleador.map((t) => (
                <Chip key={t} pressed={p.tipo_empleador === t} onToggle={() => set("tipo_empleador", t)}>
                  {TIPO_EMPLEADOR[t] ?? t}
                </Chip>
              ))}
            </Row>
          </Stack>

          <Stack as="section" className={marca("nivel")}>
            <span className="jg-etiqueta">Cargo</span>
            <Revisa si={marcados.has("nivel")} />
            <Row>
              {catalogo.niveles.map((n) => (
                <Chip key={n.nivel} pressed={p.nivel === n.nivel} onToggle={() => set("nivel", n.nivel)}>
                  {n.nombre}
                </Chip>
              ))}
            </Row>
          </Stack>

          <Stack as="section" className={marca("sueldo")}>
            <Revisa si={marcados.has("sueldo")} />
            <div className="vd-ind-fila">
              <label htmlFor={idSueldo} className="jg-etiqueta">
                Sueldo líquido al mes
              </label>
              <span className="vd-ind-v">{sueldoValido ? pesos(p.sueldo) : "entre $1 y $30.000.000"}</span>
            </div>
            <input
              id={idSueldo}
              className="jg-campo"
              inputMode="numeric"
              autoComplete="off"
              value={p.sueldo ? p.sueldo.toLocaleString("es-CL") : ""}
              onChange={(e) => set("sueldo", Number(e.target.value.replace(/\D/g, "").slice(0, 9)))}
              aria-invalid={!sueldoValido}
            />
          </Stack>

          <Stack as="section" gap={4} className={marca("riesgo")}>
            <Revisa si={marcados.has("riesgo")} />
            <Slider
              label="Cuánto riesgo toleras"
              value={p.riesgo}
              min={0}
              max={10}
              onChange={(n) => set("riesgo", n)}
              color="var(--acento)"
              display={`${p.riesgo} de 10 · ${riesgoEnPalabras(p.riesgo)}`}
            />
            <Text size="sm">Con esto elegimos qué destacarte en cada opción: el peor caso o el mejor.</Text>
          </Stack>
        </>
      )}

      <ScreenFooter>
        <Button onClick={() => onListo(p, dudaSugerida)} disabled={!catalogo || !sueldoValido}>
          Ver mis dudas
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
