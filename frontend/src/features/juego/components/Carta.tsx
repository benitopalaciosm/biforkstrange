import { useEffect, useState } from "react";
import { Button, CheckIcon, Chip, DecisionArt, DecisionList, Heading, Meta, Panel, Pill, Row, Screen, ScreenHeader, Stack, Text, cssVars } from "@/shared/ui";
import { CALIDAD, TIPO_EMPLEADOR, arte, cargoYSueldo, conSigno, deCada, deCada10, minuscula, plata, sinSueldo } from "../textos";
import type { ContraBase, Eleccion, OpcionComparada, OpcionPendiente, ParametrosComparar, Vista } from "../types";
import { CalidadTag, Cargando, ErrorCaja, LeyendaCalidad, RangoSueldo } from "./piezas";

type Internas = Record<string, string | number>;

/**
 * Cómo le va a esta opción frente a la base, con la misma suerte: en cuántos mundos ganas más, menos o igual,
 * y de cuánta plata se trata. Si casi todo es empate se dice directo; si la diferencia es chica, también.
 */
export function contraBase(c: ContraBase, base: OpcionComparada | undefined, conBase = true): { frase: string; magnitud: string | null } | null {
  if (!base || c.gana_mas_que_base === null || c.gana_menos_que_base === null) return null;
  const mas = c.gana_mas_que_base;
  const menos = c.gana_menos_que_base;
  const igual = c.igual_que_base ?? Math.max(0, 1 - mas - menos);
  if (igual >= 0.995) return { frase: "No cambia tu sueldo en ningún mundo.", magnitud: null };
  if (igual >= 0.9) return { frase: "No cambia tu sueldo en casi ningún mundo.", magnitud: null };

  const que = conBase ? ` que con «${base.nombre}»` : "";
  const n = (p: number) => Math.round(p * 10);
  const [principal, otro] = mas >= menos ? [{ p: mas, t: "más" }, { p: menos, t: "menos" }] : [{ p: menos, t: "menos" }, { p: mas, t: "más" }];
  let frase =
    n(principal.p) >= 10
      ? `En casi todos los mundos terminas ganando ${principal.t}${que}`
      : n(principal.p) <= 0
        ? `En pocos mundos cambia tu sueldo${conBase ? ` frente a «${base.nombre}»` : ""}`
        : `En ${deCada10(principal.p)} mundos terminas ganando ${principal.t}${que}`;
  const resto = [n(otro.p) >= 1 ? `en ${n(otro.p)} ${otro.t}` : null, n(igual) >= 1 ? `en ${n(igual)} igual` : null].filter(Boolean);
  if (resto.length === 1) frase += ` y ${resto[0]}`;
  if (resto.length === 2) frase += `, ${resto.join(" y ")}`;
  frase += ".";

  // Con muchos empates, la diferencia típica de todos los mundos es cero y tapa lo que pasa
  // cuando la opción sí cambia algo: ahí se muestra la diferencia solo entre esos mundos.
  const conEmpates = igual >= 0.2 && c.diferencia_si_cambia !== null && c.diferencia_si_cambia !== undefined;
  const d = conEmpates ? (c.diferencia_si_cambia as number) : c.diferencia_tipica;
  const cuando = conEmpates ? "Cuando cambia, la diferencia típica" : "La diferencia típica";
  let magnitud: string | null = null;
  if (d !== null) {
    const chica = Math.abs(d) < 0.03 * base.sueldo.p50;
    if (Math.abs(d) < 1000) magnitud = `${cuando} es casi cero.`;
    else if (chica) magnitud = `${cuando} es chica: ${conSigno(d)} al mes.`;
    else magnitud = `${cuando} es de ${conSigno(d)} al mes.`;
  }
  return { frase, magnitud };
}

/** A quien tolera poco riesgo se le destaca el piso; a quien lo busca, el techo. */
function destacado(o: OpcionComparada, base: OpcionComparada | undefined, riesgo: number): string | null {
  if (riesgo > 3 && riesgo < 7) return null;
  const piso = riesgo <= 3;
  const nombre = piso ? "Tu peor caso" : "Tu mejor caso";
  const valor = piso ? o.sueldo.p10 : o.sueldo.p90;
  if (o.es_base || !base) return `${nombre}: ${plata(valor)}`;
  const antes = piso ? base.sueldo.p10 : base.sueldo.p90;
  if (plata(antes) === plata(valor)) return `${nombre} no cambia: ${plata(valor)}`;
  return `${nombre} ${valor < antes ? "baja" : "sube"} de ${plata(antes)} a ${plata(valor)}`;
}

function OpcionConGemelos({
  o, base, tope, riesgo, selected, onSelect,
}: {
  o: OpcionComparada;
  base: OpcionComparada | undefined;
  tope: number;
  riesgo: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const nota = destacado(o, base, riesgo);
  const contra = o.es_base ? null : contraBase(o, base);
  const supuesto = Object.values(o.parametros ?? {}).join(" · ");
  const meses = Math.round(o.meses_sin_trabajo);
  return (
    <button type="button" className="vd-opcion jg-opcion" aria-pressed={selected} onClick={onSelect}>
      <span className="jg-opcion-cabeza">
        <span className="vd-opcion-titulo">{o.nombre}</span>
        {o.detalle && <span className="vd-opcion-sub">{o.detalle}</span>}
        {supuesto && <span className="vd-opcion-sub">Tus gemelos van a: {supuesto}</span>}
        <span className="vd-opcion-tags">
          <CalidadTag calidad={o.calidad} />
        </span>
      </span>

      <span className="jg-opcion-bloque">
        <span className="jg-chico">Sueldo en 10 años · gemelo del medio</span>
        <span className="jg-opcion-num">{plata(o.sueldo.p50)}</span>
        <RangoSueldo rango={o.sueldo} tope={tope} />
        <span className="jg-chico">Del 10% peor al 10% mejor</span>
        {nota && <span className="jg-destacado">{nota}</span>}
      </span>

      <span className="jg-opcion-bloque">
        <span className="jg-chico">Pasaron por cesantía</span>
        <span className="jg-fuerte">{deCada(o.paso_por_cesantia)}</span>
        <span className="jg-chico">
          {meses > 0 ? `En promedio, ${meses} ${meses === 1 ? "mes" : "meses"} sin trabajo en 10 años` : "Casi sin tiempo sin trabajo"}
        </span>
      </span>

      <span className="jg-opcion-bloque">
        <span className="jg-chico">Cargo más probable</span>
        <span className="jg-fuerte">{o.cargo_mas_probable}</span>
      </span>

      <span className="jg-opcion-bloque">
        {contra ? (
          <>
            <span className="jg-frase">{contra.frase}</span>
            {contra.magnitud && <span className="jg-chico">{contra.magnitud}</span>}
          </>
        ) : (
          <span className="jg-frase">Con esta opción se comparan las demás.</span>
        )}
      </span>

      <span className="vd-opcion-check">
        <CheckIcon />
      </span>
    </button>
  );
}

/** El porqué: según lo que salió en el dado, cuántos gemelos son y en cuántos esta opción terminó mejor. */
function Porque({ o, base }: { o: OpcionComparada; base: OpcionComparada | undefined }) {
  const compara = !o.es_base && base !== undefined;
  return (
    <Stack as="section" gap={8}>
      <Heading level={3} as="h2">
        El porqué de «{o.nombre}»
      </Heading>
      <table className="jg-tabla">
        <thead>
          <tr>
            <th>En los mundos donde…</th>
            <th>Mundos</th>
            {compara && <th>Frente a «{base!.nombre}»</th>}
          </tr>
        </thead>
        <tbody>
          {o.por_resultado.map((r) => (
            <tr key={r.resultado}>
              <td>{r.texto || r.resultado}</td>
              <td>{deCada10(r.prob)}</td>
              {compara && (
                <td>
                  {r.gana_mas_que_base === null || r.gana_menos_que_base === null ? (
                    "—"
                  ) : (
                    <>
                      {Math.round(r.gana_mas_que_base * 10)} más · {Math.round((r.igual_que_base ?? 0) * 10)} igual · {Math.round(r.gana_menos_que_base * 10)} menos
                      {r.diferencia_tipica !== null && Math.abs(r.diferencia_tipica) >= 1000 && (
                        <span className="jg-chico" style={{ display: "block" }}>
                          típico {conSigno(r.diferencia_tipica)} al mes
                        </span>
                      )}
                    </>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {compara && (
        <Text size="sm">
De cada 10 gemelos a los que les pasó eso: cuántos terminan ganando más, igual o menos que su par que eligió «{base!.nombre}» con la
          misma suerte. «Igual» es a menos de 0,5%.
        </Text>
      )}
    </Stack>
  );
}

/** La carta: la decisión pendiente con lo que vivieron los gemelos. Viene de "3 · Decisión del año" del kit. */
export function Carta({
  vista, riesgo, cargando, recalculando, error, onElegir, onComparar,
}: {
  vista: Vista;
  riesgo: number;
  cargando: boolean;
  recalculando: boolean;
  error: string | null;
  onElegir: (e: Eleccion) => void;
  onComparar: (p: ParametrosComparar) => void;
}) {
  const pendiente = vista.pendiente!;
  const [sel, setSel] = useState<string | null>(null);
  const [internas, setInternas] = useState<Internas>({});
  const [filtro, setFiltro] = useState("");

  // otra carta: se parte sin nada marcado
  const llave = `${vista.historia.length}:${vista.anio_en_curso?.decisiones.length ?? 0}:${pendiente.decision}`;

  useEffect(() => {
    setSel(null);
    setInternas({});
    setFiltro("");
  }, [llave]);

  const e = vista.estado;
  const anio = Math.min(vista.anio + 1, vista.anios);
  const comparacion = pendiente.comparacion;
  const comparadas = comparacion?.opciones ?? [];
  const base = comparadas.find((o) => o.es_base);
  const tope = Math.max(...comparadas.map((o) => o.sueldo.p90), 1) * 1.05;
  const opcion: OpcionPendiente | undefined = pendiente.opciones.find((o) => o.opcion === sel);
  const faltan = opcion ? opcion.elecciones_internas.filter((i) => internas[i.variable] === undefined) : [];
  const foco = comparadas.find((o) => o.opcion === sel) ?? comparadas.find((o) => !o.es_base) ?? comparadas[0];

  const elegirOpcion = (id: string) => {
    if (id === sel) return;
    setSel(id);
    setInternas({});
  };

  const elegirInterna = (variable: string, valor: string | number) => {
    if (!opcion) return;
    const nuevas = { ...internas, [variable]: valor };
    setInternas(nuevas);
    // con todo elegido, los gemelos de esta opción se vuelven a simular por ese camino
    if (comparacion && opcion.elecciones_internas.every((i) => nuevas[i.variable] !== undefined)) onComparar({ [opcion.opcion]: nuevas });
  };

  const confirmar = () => {
    if (!opcion || faltan.length > 0) return;
    onElegir({
      decision: pendiente.decision,
      opcion: opcion.opcion,
      ...(opcion.elecciones_internas.length > 0 ? { parametros: internas } : {}),
    });
  };

  const muchas = pendiente.opciones.length > 8;
  const visibles = muchas && filtro.trim() ? pendiente.opciones.filter((o) => o.nombre.toLowerCase().includes(filtro.trim().toLowerCase())) : pendiente.opciones;

  return (
    <Screen gap={16} className={comparadas.length > 4 ? "jg-ancha jg-muy-ancha" : "jg-ancha"}>
      <ScreenHeader left={<Pill style={{ whiteSpace: "nowrap" }}>Año {anio} · {e.edad} años</Pill>} right={<Meta>{anio} de {vista.anios}</Meta>} />
      <Text size="sm">
        <strong>Tu situación:</strong> {e.edad} años · {cargoYSueldo(e)}
        {sinSueldo(e) ? ` · último sueldo ${plata(e.sueldo_ref)}` : " al mes"}
        {!sinSueldo(e) && e.tipo_empleador ? ` · ${TIPO_EMPLEADOR[e.tipo_empleador] ?? e.tipo_empleador}` : ""}
        {e.rubro ? ` · ${e.rubro}` : ""} · año {anio} de {vista.anios}
      </Text>

      <Stack gap={6} style={{ marginTop: 4 }}>
        <Row gap={6} style={{ alignItems: "center" }}>
          <Meta>{pendiente.nombre}</Meta>
          <CalidadTag calidad={pendiente.calidad} />
        </Row>
        {pendiente.narrativa && <Text className="jg-situacion">{pendiente.narrativa.situacion}</Text>}
        <Heading level={2} as="h1">
          {pendiente.pregunta}
        </Heading>
        {comparacion ? (
          <Meta>
            {comparacion.gemelos} gemelos por opción · {comparacion.anios} años · toca una para elegirla
          </Meta>
        ) : (
          <Meta>{pendiente.opciones.length} opciones · toca una para elegirla</Meta>
        )}
      </Stack>

      {comparacion ? (
        <div
          className="jg-opciones"
          role="group"
          aria-label="Opciones, lado a lado"
          data-muchas={comparadas.length > 2}
          data-cargando={recalculando}
          style={cssVars({ "--jg-n": comparadas.length })}
        >
          {comparadas.map((o) => (
            <OpcionConGemelos key={o.opcion} o={o} base={base} tope={tope} riesgo={riesgo} selected={sel === o.opcion} onSelect={() => elegirOpcion(o.opcion)} />
          ))}
        </div>
      ) : (
        <Stack gap={12} className="jg-columna">
          <Text size="sm">Esta carta tiene demasiadas opciones para simular gemelos con cada una. Aquí eliges con lo que dice cada opción.</Text>
          {muchas && (
            <input className="jg-campo" type="search" placeholder="Filtrar opciones" aria-label="Filtrar opciones" value={filtro} onChange={(ev) => setFiltro(ev.target.value)} />
          )}
          <DecisionList<string>
            label="Opciones"
            value={sel}
            onChange={elegirOpcion}
            options={visibles.slice(0, 40).map((o) => ({
              id: o.opcion,
              art: <DecisionArt kind={arte(pendiente.categoria)} />,
              title: o.nombre,
              subtitle: o.detalle || undefined,
              tags: [{ label: CALIDAD[o.calidad]?.nombre ?? o.calidad, tone: o.calidad === "supuesto" ? ("minus" as const) : ("default" as const) }],
            }))}
          />
          {visibles.length > 40 && <Text size="sm">Hay {visibles.length - 40} más: usa el filtro.</Text>}
        </Stack>
      )}

      {recalculando && <Cargando>Tus gemelos están viviendo ese camino…</Cargando>}

      {opcion && opcion.elecciones_internas.length > 0 && (
        <Panel className="jg-columna">
          {opcion.elecciones_internas.map((i) => (
            <Stack key={i.variable} gap={8}>
              <Heading level={3} as="h2">
                {i.pregunta}
              </Heading>
              <Row>
                {i.alternativas.map((a) => (
                  <Chip key={String(a.valor)} pressed={internas[i.variable] === a.valor} onToggle={() => elegirInterna(i.variable, a.valor)}>
                    {a.nombre}
                    {comparadas.find((c) => c.opcion === opcion.opcion)?.parametros?.[i.variable] === a.valor && internas[i.variable] === undefined
                      ? " · lo más común"
                      : ""}
                  </Chip>
                ))}
              </Row>
            </Stack>
          ))}
          {comparacion && (
            <Text size="sm">
              {faltan.length > 0
                ? "Mientras no elijas, los gemelos de esta opción van a donde va más gente."
                : "Los gemelos de esta opción ya van por el camino que elegiste."}
            </Text>
          )}
        </Panel>
      )}

      {comparacion && foco && (
        <Stack gap={16} className="jg-columna">
          <Porque o={foco} base={base} />
          {pendiente.creencia_vs_dato && (
            <Panel>
              <Meta>Lo que se cree y lo que dice el dato</Meta>
              <Text>{pendiente.creencia_vs_dato}</Text>
            </Panel>
          )}
          {pendiente.evidencia.length > 0 && (
            <Stack gap={4}>
              <Meta>De dónde sale</Meta>
              {pendiente.evidencia.map((ev) => (
                <Text size="sm" key={ev.fuente + ev.cifra}>
                  {ev.cifra}
                  {ev.uso ? ` (${minuscula(ev.uso)})` : ""}
                </Text>
              ))}
            </Stack>
          )}
          <LeyendaCalidad />
        </Stack>
      )}

      <div className="jg-pie-fijo">
        {error && <ErrorCaja error={error} />}
        {cargando && <Cargando>Tirando tu dado y viviendo el año…</Cargando>}
        {opcion && faltan.length > 0 && !cargando && <Text size="sm">Falta elegir: {faltan.map((f) => minuscula(f.pregunta)).join(" ")}</Text>}
        <Button onClick={confirmar} disabled={!opcion || faltan.length > 0 || cargando || recalculando}>
          {cargando ? "Tirando el dado…" : opcion ? `Elegir «${opcion.nombre}»` : "Toca una opción"}
        </Button>
      </div>
    </Screen>
  );
}
