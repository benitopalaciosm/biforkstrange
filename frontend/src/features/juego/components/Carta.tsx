import { useEffect, useRef, useState } from "react";
import { Button, CheckIcon, Chip, DecisionArt, DecisionList, Heading, Meta, Panel, Pill, Row, Screen, ScreenHeader, Stack, Text, cssVars } from "@/shared/ui";
import { CALIDAD, TIPO_EMPLEADOR, arte, cargoYSueldo, conSigno, deCada, minuscula, plata, sinSueldo } from "../textos";
import type { ContraBase, Eleccion, OpcionComparada, OpcionPendiente, ParametrosComparar, Vista } from "../types";
import { Abanico, BarraPartes, Info, LeyendaNube, NubeGemelos, ProgresoAnios, repartir, type Reparto } from "./graficos";
import { CalidadTag, Cargando, ErrorCaja, LeyendaCalidad, Pensando, RangoSueldo } from "./piezas";
import { GEMELOS } from "../api";

type Internas = Record<string, string | number>;

/** El veredicto en una frase. Si casi todos empatan, eso va primero: no se anuncia "mejor" por una diferencia que casi nadie ve. */
function veredictoDe(r: Reparto, que: string): string {
  if (r.igual >= 0.995) return `Da lo mismo que ${que} para tu sueldo.`;
  if (r.igual >= 0.9) return `Casi no cambia tu sueldo frente a ${que}.`;
  if (r.igual >= 0.6) {
    const hacia = r.mas > r.menos * 1.5 ? " Cuando cambia, suele ser para mejor." : r.menos > r.mas * 1.5 ? " Cuando cambia, suele ser para peor." : "";
    return `Casi siempre da lo mismo que ${que}.${hacia}`;
  }
  if (r.mas - r.menos > 0.15) return `Suele salir mejor que ${que}.`;
  if (r.menos - r.mas > 0.15) return `Suele salir peor que ${que}.`;
  return `Es una apuesta: puede salir mejor o peor que ${que}.`;
}

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
  if (igual >= 0.9) return { frase: "Casi no cambia tu sueldo.", magnitud: null };

  const que = conBase ? `«${base.nombre}»` : "la otra opción";
  const frase = veredictoDe({ mas, igual, menos }, que);

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

const repartoDe = (o: OpcionComparada): Reparto | null =>
  o.es_base || o.gana_mas_que_base === null || o.gana_menos_que_base === null
    ? null
    : { mas: o.gana_mas_que_base, menos: o.gana_menos_que_base, igual: o.igual_que_base ?? Math.max(0, 1 - o.gana_mas_que_base - o.gana_menos_que_base) };

/** La opción para elegir: qué es, el veredicto en una frase y el sueldo típico. La simulación va aparte, más abajo. */
function OpcionConGemelos({
  o, base, unica, tope, riesgo, selected, onSelect, supuesto, edadFinal, sueldoHoy,
}: {
  o: OpcionComparada;
  base: OpcionComparada | undefined;
  /** La otra opción, cuando la carta tiene solo dos: con ella se compara la base. */
  unica: OpcionComparada | undefined;
  tope: number;
  riesgo: number;
  selected: boolean;
  onSelect: () => void;
  /** Lo que se supuso dentro de la opción, ya con nombre ("Valparaíso"), no con código. */
  supuesto: string;
  edadFinal: number;
  sueldoHoy: number | null;
}) {
  const nota = destacado(o, base, riesgo);
  const contra = o.es_base ? null : contraBase(o, base);
  let veredicto = contra ? contra.frase : "Con esta se comparan las demás.";
  const r = o.es_base && unica ? repartoDe(unica) : null;
  // la base, mirada desde su lado: lo contrario de lo que le pasa a la otra
  if (r && unica) veredicto = veredictoDe({ mas: r.menos, igual: r.igual, menos: r.mas }, `«${unica.nombre}»`);
  return (
    <button type="button" className="vd-opcion jg-opcion" aria-pressed={selected} onClick={onSelect}>
      <span className="jg-opcion-cabeza">
        <span className="vd-opcion-titulo">{o.nombre}</span>
        {o.detalle && <span className="vd-opcion-sub">{o.detalle}</span>}
        {supuesto && <span className="vd-opcion-sub">En la simulación vas a: {supuesto}</span>}
        <span className="jg-veredicto">{veredicto}</span>
      </span>

      <span className="jg-opcion-bloque">
        <span className="jg-chico">Sueldo típico a los {edadFinal} años</span>
        <span className="jg-opcion-num">{plata(o.sueldo.p50)}</span>
        {sueldoHoy !== null && <span className="jg-chico">Hoy ganas {plata(sueldoHoy)}</span>}
        <span className="jg-rango-solo">
          <RangoSueldo rango={o.sueldo} tope={tope} />
        </span>
        <span className="jg-chico">
          Con mala suerte <strong>{plata(o.sueldo.p10)}</strong> · con buena suerte <strong>{plata(o.sueldo.p90)}</strong>
        </span>
        {nota && <span className="jg-destacado">{nota}</span>}
      </span>

      <span className="vd-opcion-check">
        <CheckIcon />
      </span>
    </button>
  );
}

/**
 * La simulación, aparte de las opciones: los gemelos vivieron todas las opciones con la misma suerte,
 * y aquí se cuenta con cuál terminó ganando más cada uno.
 */
function Simulacion({ comparadas, base, gemelos, edadFinal }: { comparadas: OpcionComparada[]; base: OpcionComparada; gemelos: number; edadFinal: number }) {
  const otras = comparadas.filter((o) => !o.es_base && repartoDe(o));
  if (otras.length === 0) return null;
  const nubes = otras.length <= 2;
  return (
    <section className="jg-seccion jg-simulacion">
      <Stack gap={4}>
        <Meta>La simulación</Meta>
        <Heading level={3} as="h2">
          {gemelos} mundos posibles, {comparadas.length === 2 ? "dos vidas" : `${comparadas.length} vidas`} en cada uno
        </Heading>
        <Text size="sm">
          En cada mundo la suerte es distinta: en uno hay recesión, en otro te despiden, en otro no pasa nada. Y en cada mundo tu gemelo vivió
          hasta los {edadFinal} años una vez con cada opción. Así, cuando en un mundo gana una opción, es por la decisión y no por la suerte.
        </Text>
      </Stack>
      {otras.map((o) => {
        const reparto = repartoDe(o)!;
        const [mas, igual, menos] = repartir([reparto.mas, reparto.igual, reparto.menos]);
        const magnitud = contraBase(o, base)?.magnitud;
        return (
          <div className="jg-duelo" key={o.opcion}>
            {otras.length > 1 && (
              <span className="jg-fuerte">
                «{o.nombre}» contra «{base.nombre}»
              </span>
            )}
            <span className="jg-chico">De cada 100 mundos (cada punto son {Math.round(gemelos / 100)}):</span>
            {nubes ? (
              <NubeGemelos reparto={reparto} etiqueta={`De cada 100 mundos, en ${mas} ganas más con «${o.nombre}», en ${igual} terminas igual y en ${menos} ganas más con «${base.nombre}»`} />
            ) : (
              <BarraPartes
                partes={[
                  { nombre: "", prob: reparto.mas, tono: "mas" },
                  { nombre: "", prob: reparto.igual, tono: "igual" },
                  { nombre: "", prob: reparto.menos, tono: "menos" },
                ]}
                sinLeyenda
              />
            )}
            <LeyendaNube reparto={reparto} nombre={o.nombre} contra={base.nombre} />
            {magnitud && <span className="jg-chico">{magnitud}</span>}
          </div>
        );
      })}
    </section>
  );
}

/** El porqué: según lo que salió en el dado, cuántos gemelos son y cómo terminaron frente a su par de la opción base. */
function Porque({ o, base }: { o: OpcionComparada; base: OpcionComparada | undefined }) {
  const compara = !o.es_base && base !== undefined;
  return (
    <Stack gap={0}>
      {o.por_resultado.map((r) => {
        const hay = compara && r.gana_mas_que_base !== null && r.gana_menos_que_base !== null;
        const igual = r.igual_que_base ?? 0;
        return (
          <div className="jg-resultado" key={r.resultado}>
            <span className="jg-resultado-cabeza">
              <span>{r.texto || r.resultado}</span>
              <b>en {Math.round(r.prob * 100)} de 100 mundos</b>
            </span>
            <span className="jg-medidor" aria-hidden="true">
              <i style={{ width: `${Math.max(2, r.prob * 100)}%`, background: "var(--tinta)" }} />
            </span>
            {hay &&
              (igual >= 0.995 ? (
                <span className="jg-chico">En esos mundos te va igual que con «{base!.nombre}».</span>
              ) : (
                <>
                  <span className="jg-chico">En esos mundos, frente a «{base!.nombre}» (de cada 100):</span>
                  <BarraPartes
                    partes={[
                      { nombre: "ganan más", prob: r.gana_mas_que_base as number, tono: "mas" },
                      { nombre: "igual", prob: igual, tono: "igual" },
                      { nombre: "ganan menos", prob: r.gana_menos_que_base as number, tono: "menos" },
                    ]}
                  />
                  {r.diferencia_si_cambia != null && Math.abs(r.diferencia_si_cambia) >= 1000 && (
                    <span className="jg-chico">Cuando cambia, la diferencia típica es de {conSigno(r.diferencia_si_cambia)} al mes.</span>
                  )}
                </>
              ))}
          </div>
        );
      })}
    </Stack>
  );
}

/** La carta: la decisión pendiente con lo que vivieron los gemelos. Viene de "3 · Decisión del año" del kit. */
export function Carta({
  vista, riesgo, cargando, recalculando, error, onElegir, onComparar, onAyuda,
}: {
  onAyuda: () => void;
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

  const panelInternas = useRef<HTMLDivElement>(null);
  const elegirOpcion = (id: string) => {
    if (id === sel) return;
    setSel(id);
    setInternas({});
    // si la opción pide algo más (a qué rubro, a qué región), se lleva la vista hasta esa pregunta
    if ((pendiente.opciones.find((o) => o.opcion === id)?.elecciones_internas.length ?? 0) > 0) {
      setTimeout(() => panelInternas.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    }
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

  /** "Valparaíso" en vez del código 3: lo que se supuso dentro de la opción, con su nombre. */
  const supuestoDe = (o: OpcionComparada) => {
    const internas = pendiente.opciones.find((x) => x.opcion === o.opcion)?.elecciones_internas ?? [];
    return Object.entries(o.parametros ?? {})
      .map(([variable, valor]) => internas.find((i) => i.variable === variable)?.alternativas.find((a) => a.valor === valor)?.nombre ?? (typeof valor === "string" ? valor : null))
      .filter(Boolean)
      .join(" · ");
  };
  /** Hasta qué edad vivieron los gemelos de esta carta (no siempre es el fin de la partida). */
  const edadGemelos = comparadas[0]?.trayectoria[comparadas[0].trayectoria.length - 1]?.edad ?? vista.edad_final;
  const sueldoHoy = sinSueldo(e) ? null : e.sueldo;
  const hoy = { edad: e.edad, sueldo: sinSueldo(e) ? 0 : e.sueldo };
  const sinEfecto = comparadas.length > 1 && comparadas.every((o) => o.es_base || (o.igual_que_base ?? 0) >= 0.9);

  return (
    <Screen gap={16} className={comparadas.length > 4 ? "jg-ancha jg-muy-ancha" : "jg-ancha"}>
      <ScreenHeader left={<Pill style={{ whiteSpace: "nowrap" }}>Año {anio} · {e.edad} años</Pill>} right={<Meta>{anio} de {vista.anios}</Meta>} />
      {cargando && <Pensando titulo={`Mundo ${GEMELOS + 1} · año ${anio}`} />}
      <ProgresoAnios actual={anio} total={vista.anios} />
      <Text size="sm">
        <strong>Tú, en el mundo {GEMELOS + 1}:</strong> {cargoYSueldo(e)}
        {sinSueldo(e) ? ` · último sueldo ${plata(e.sueldo_ref)}` : " al mes"}
        {!sinSueldo(e) && e.tipo_empleador ? ` · ${TIPO_EMPLEADOR[e.tipo_empleador] ?? e.tipo_empleador}` : ""}
        {e.rubro ? ` · ${e.rubro}` : ""}
      </Text>

      <Stack gap={8} style={{ marginTop: 4 }}>
        <Meta>{pendiente.nombre}</Meta>
        {pendiente.narrativa && (
          <div className="jg-mensaje" key={llave}>
            <span className="jg-mensaje-escribiendo" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <p className="jg-mensaje-texto">{pendiente.narrativa.situacion}</p>
          </div>
        )}
        <Heading level={2} as="h1">
          {pendiente.pregunta}
        </Heading>
        {comparacion ? (
          <Text size="sm">
            Simulamos {comparacion.gemelos} mundos posibles. En cada uno, tu gemelo ya vivió cada opción hasta los {edadGemelos} años. Mira cómo le fue y toca la que eliges para tu mundo, el {GEMELOS + 1}.
          </Text>
        ) : (
          <Meta>{pendiente.opciones.length} opciones · toca una para elegirla</Meta>
        )}
        <button type="button" className="jg-ayuda" onClick={onAyuda}>
          ¿Cómo funciona la simulación?
        </button>
        {sinEfecto && <Text size="sm" className="jg-destacado">En esta decisión tu sueldo termina casi igual con cualquier opción: elige por lo que dice cada una.</Text>}
      </Stack>

      {comparacion ? (
        <div
          className="jg-opciones"
          role="group"
          aria-label="Opciones"
          data-muchas={comparadas.length > 2}
          data-cargando={recalculando}
          style={cssVars({ "--jg-n": comparadas.length })}
        >
          {comparadas.map((o) => (
            <OpcionConGemelos
              key={o.opcion}
              o={o}
              base={base}
              unica={comparadas.length === 2 ? comparadas.find((x) => !x.es_base) : undefined}
              tope={tope}
              riesgo={riesgo}
              selected={sel === o.opcion}
              onSelect={() => elegirOpcion(o.opcion)}
              supuesto={supuestoDe(o)}
              edadFinal={edadGemelos}
              sueldoHoy={sueldoHoy}
            />
          ))}
        </div>
      ) : (
        <Stack gap={12} className="jg-columna">
          <Text size="sm">Esta carta tiene demasiadas opciones para simular los mundos con cada una. Aquí eliges con lo que dice cada opción.</Text>
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

      {comparacion && (
        <Info pregunta="¿Qué es el sueldo típico y la barra?">
          <strong>Sueldo típico:</strong> si ordenas los {comparacion.gemelos} mundos de esa opción desde donde ganas menos hasta donde ganas más, es el que
          queda justo al medio. <strong>Mala y buena suerte:</strong> la barra va desde el sueldo que no alcanzas solo en 1 de cada 10 mundos hasta el que
          superas solo en 1 de cada 10.
        </Info>
      )}

      {recalculando && <Cargando>Simulando los mundos por ese camino…</Cargando>}

      {opcion && opcion.elecciones_internas.length > 0 && (
        <div ref={panelInternas} className="jg-columna">
        <Panel className="jg-falta">
          <Meta>Falta un detalle de «{opcion.nombre}»</Meta>
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
                ? "Mientras no elijas, en la simulación de esta opción vas a donde va más gente."
                : "La simulación de esta opción ya va por el camino que elegiste."}
            </Text>
          )}
        </Panel>
        </div>
      )}

      {comparacion && foco && (
        <Stack gap={12} className="jg-columna">
          {base && <Simulacion comparadas={comparadas} base={base} gemelos={comparacion.gemelos} edadFinal={edadGemelos} />}
          <section className="jg-seccion" key={`abanico:${foco.opcion}`}>
            <Heading level={3} as="h2">
              «{foco.nombre}», año a año
            </Heading>
            <Abanico
              puntos={foco.trayectoria}
              hoy={hoy}
              referencia={foco.es_base ? undefined : base?.trayectoria}
              nombreReferencia={foco.es_base ? undefined : base?.nombre}
            />
            <Info pregunta="¿Qué muestra este gráfico?">
              Tu sueldo en los mundos donde eliges «{foco.nombre}», desde hoy hasta los {edadGemelos} años. La línea azul es el mundo del medio. La
              franja celeste contiene 8 de cada 10 mundos: mientras más se abre, más depende de la suerte. Toca otra opción para ver la suya.
            </Info>
          </section>

          <section className="jg-seccion">
            <Heading level={3} as="h2">
              Además del sueldo
            </Heading>
            {comparadas.map((o) => {
              const meses = Math.round(o.meses_sin_trabajo);
              return (
                <div className="jg-fila-opcion" key={o.opcion} data-foco={comparadas.length > 1 && o.opcion === sel}>
                  <span className="jg-fuerte">{o.nombre}</span>
                  <span className="jg-chico">
                    Quedas sin trabajo alguna vez en <strong>{deCada(o.paso_por_cesantia)}</strong> mundos
                    {meses > 0 ? ` · en promedio ${meses} ${meses === 1 ? "mes" : "meses"} sin pega en todo el período` : ""}
                  </span>
                  <span className="jg-medidor" aria-hidden="true">
                    <i style={{ width: `${Math.max(1, o.paso_por_cesantia * 100)}%` }} />
                  </span>
                  <span className="jg-chico">Cargo a los {edadGemelos} años (de cada 100 mundos):</span>
                  <BarraPartes partes={o.cargos.map((c) => ({ nombre: c.cargo, prob: c.prob }))} />
                </div>
              );
            })}
            <Info pregunta="¿Por qué en tantos mundos paso por cesantía?">
              Cuenta cualquier mundo donde estás al menos un mes sin trabajo en todo el período, aunque después encuentres otro: un despido, el
              cierre de la empresa, una renuncia o un tiempo estudiando.
            </Info>
          </section>

          <details className="jg-plegable">
            <summary>¿Por qué sale así «{foco.nombre}»?</summary>
            <Stack gap={10}>
              <Text size="sm">Lo primero que te puede pasar si la eliges, en cuántos mundos pasa, y cómo terminas después de cada cosa.</Text>
              <Porque o={foco} base={base} />
            </Stack>
          </details>

          <details className="jg-plegable">
            <summary>De dónde salen los números</summary>
            <Stack gap={8}>
              {pendiente.creencia_vs_dato && (
                <Text size="sm">
                  <strong>Lo que se cree y lo que dice el dato:</strong> {pendiente.creencia_vs_dato}
                </Text>
              )}
              {pendiente.evidencia.map((ev) => (
                <Text size="sm" key={ev.fuente + ev.cifra}>
                  {ev.cifra}
                </Text>
              ))}
              <Row gap={6} style={{ alignItems: "center" }}>
                <span className="jg-chico">Esta decisión:</span>
                <CalidadTag calidad={pendiente.calidad} />
              </Row>
              <LeyendaCalidad />
            </Stack>
          </details>
        </Stack>
      )}

      <div className="jg-pie-fijo">
        {error && <ErrorCaja error={error} />}
        {cargando && <Cargando>Tirando tu dado y viviendo el año…</Cargando>}
        {opcion && faltan.length > 0 && !cargando && <Text size="sm">Falta elegir: {faltan.map((f) => minuscula(f.pregunta)).join(" ")}</Text>}
        <Button onClick={confirmar} disabled={!opcion || faltan.length > 0 || cargando || recalculando}>
          {cargando ? "Tirando el dado…" : opcion ? `Elegir «${opcion.nombre}» y tirar mi dado` : "Toca una opción"}
        </Button>
      </div>
    </Screen>
  );
}
