import { Button, Heading, Meta, Narrative, NightBand, Panel, Pill, Screen, ScreenFooter, ScreenHeader, SlowReveal, Stack, Text, YearTicker } from "@/shared/ui";
import { TIPO_EMPLEADOR, aniosDe, cargoYSueldo, deCada, deCada10, pesos, plata, sinSueldo, situacion } from "../textos";
import type { Anio, Estado, Vista } from "../types";
import { Noticia } from "./piezas";

/** Todo lo que pasó entre la elección y la siguiente decisión pendiente: años cerrados y lo que va del año en curso. */
export function loNuevo(previa: Vista | null, vista: Vista): Anio[] {
  const todos = [...vista.historia, ...(vista.anio_en_curso ? [vista.anio_en_curso] : [])];
  if (!previa) return todos;
  const yaDecisiones = previa.anio_en_curso?.decisiones.length ?? 0;
  const yaEventos = previa.anio_en_curso?.eventos.length ?? 0;
  return todos
    .slice(previa.historia.length)
    .map((a, i) => (i === 0 ? { ...a, decisiones: a.decisiones.slice(yaDecisiones), eventos: a.eventos.slice(yaEventos) } : a));
}

const queTanProbable = (prob: number) => (prob >= 0.995 ? "Era seguro" : `Pasa en ${deCada(prob)}`);

function Quedaste({ antes, ahora }: { antes: Estado | undefined; ahora: Estado }) {
  const sueldo = sinSueldo(ahora)
    ? `Sin sueldo · el último fue ${pesos(ahora.sueldo_ref)}`
    : antes && !sinSueldo(antes) && antes.sueldo !== ahora.sueldo
      ? `${pesos(antes.sueldo)} → ${pesos(ahora.sueldo)}`
      : pesos(ahora.sueldo);
  const cargo = antes && antes.cargo !== ahora.cargo ? `${antes.cargo} → ${ahora.cargo}` : ahora.cargo;
  const donde = [TIPO_EMPLEADOR[ahora.tipo_empleador] ?? ahora.tipo_empleador, ahora.rubro].filter(Boolean).join(" · ");
  return (
    <Panel>
      <Meta>Cómo quedaste · {ahora.edad} años</Meta>
      <div className="jg-datos">
        <div className="jg-dato">
          <span>Sueldo al mes</span>
          <span>{sueldo}</span>
        </div>
        <div className="jg-dato">
          <span>Cargo</span>
          <span>{cargo}</span>
        </div>
        <div className="jg-dato">
          <span>Situación</span>
          <span>{situacion(ahora.estado)}</span>
        </div>
        {donde && !sinSueldo(ahora) && (
          <div className="jg-dato">
            <span>Dónde</span>
            <span>{donde}</span>
          </div>
        )}
      </div>
    </Panel>
  );
}

/**
 * Qué te pasó: el dado, las noticias del año y cómo quedaste.
 * Viene de "4 · Work and travel" / "5 · Las noches largas" (resultado del año) y "6 · Años sin decidir" (años que pasan) del kit.
 */
export function QuePaso({ previa, vista, onSeguir }: { previa: Vista | null; vista: Vista; onSeguir: () => void }) {
  const tramos = loNuevo(previa, vista).filter((a) => a.fin || a.decisiones.length > 0 || a.eventos.some((e) => !e.rutina));
  const dado = tramos[0]?.decisiones[0];
  const cerrados = tramos.filter((a) => a.fin);
  const primero = tramos[0];
  const quedoSinTrabajo = vista.estado.estado === "buscando" && previa?.estado.estado !== "buscando";
  const noche = dado?.tono === "malo" || quedoSinTrabajo;

  const edadInicial = vista.edad_final - vista.anios;
  const proximo = Math.min(vista.anio + 1, vista.anios);
  // una ronda puede ocupar varios años (un doctorado, cinco): se cuentan por edad
  const edades: number[] = [];
  for (const a of cerrados) for (let ed = a.edad; ed < a.fin!.edad; ed++) edades.push(ed);
  const mismoAnio = !vista.terminada && cerrados.length === 0;
  const boton = vista.terminada ? "Ver cómo terminaste" : mismoAnio ? "Seguir: otra decisión este año" : `Seguir al año ${proximo}`;

  return (
    <Screen tone={noche ? "noche" : "dia"} gap={16} key={`${vista.historia.length}:${vista.anio_en_curso?.decisiones.length ?? 0}`}>
      <ScreenHeader
        left={<Pill style={{ whiteSpace: "nowrap" }}>{primero ? `${aniosDe(primero.edad, primero.fin?.edad, edadInicial)} · ${primero.edad} años` : `Año ${proximo}`}</Pill>}
        right={<Meta>Qué te pasó</Meta>}
      />

      {edades.length > 1 && (
        <Stack gap={6}>
          <YearTicker years={edades.map((ed) => `Año ${ed - edadInicial + 1}`)} stepMs={900} />
          <Text>Pasaron {edades.length} años antes de tu siguiente decisión.</Text>
        </Stack>
      )}

      {dado && (
        <Stack gap={8}>
          <Meta>Elegiste «{dado.opcion_nombre}» · tu dado</Meta>
          <SlowReveal delay={0.15}>
            <Narrative strong>{dado.texto}</Narrative>
          </SlowReveal>
          <SlowReveal delay={0.7}>
            <Text size="sm">
              {dado.prob >= 0.995 ? "Con esta opción, esto era seguro." : `Con esta opción, esto pasa en ${deCada10(dado.prob)} mundos.`}
            </Text>
          </SlowReveal>
        </Stack>
      )}

      {tramos.map((a, i) => {
        const decisiones = i === 0 ? a.decisiones.slice(1) : a.decisiones;
        const eventos = a.eventos.filter((e) => !e.rutina);
        const nada = decisiones.length === 0 && eventos.length === 0;
        return (
          <Stack as="section" gap={8} key={`${a.anio}:${a.edad}`}>
            <Meta>
              {aniosDe(a.edad, a.fin?.edad, edadInicial)} · {a.edad} años{a.fin ? "" : " · sigue en curso"}
            </Meta>
            {eventos.map((e, j) => (
              <Noticia key={`e${j}`} titulo={e.nombre} texto={e.texto} lado={e.directo ? undefined : queTanProbable(e.prob)} />
            ))}
            {decisiones.map((d, j) => (
              <Noticia
                key={`d${j}`}
                titulo={d.nombre}
                texto={d.narrativa ? `${d.narrativa.situacion} ${d.texto}` : d.texto}
                lado={queTanProbable(d.prob)}
              />
            ))}
            {nada && <Text size="sm">{a.fin && a.fin.edad - a.edad > 1
                  ? "Nada más fuera de lo normal en estos años."
                  : i === 0 && dado
                    ? "Nada más fuera de lo normal este año."
                    : "Un año sin noticias: la vida siguió su curso."}</Text>}
            {a.fin && a.fin.edad - a.edad > 1 && (
              <Text size="sm">
                Esto te tomó {a.fin.edad - a.edad} años: partiste con {a.edad} y sales con {a.fin.edad}.
              </Text>
            )}
            {a.fin && tramos.length > 1 && <Text size="sm">Cierras el año con: {cargoYSueldo(a.fin, true)}.</Text>}
          </Stack>
        );
      })}

      {quedoSinTrabajo && (
        <NightBand>
          <Meta>Quedaste sin trabajo</Meta>
          <Text>Tu último sueldo fue {plata(vista.estado.sueldo_ref)}. La próxima carta es cómo sigues buscando.</Text>
        </NightBand>
      )}

      <Quedaste antes={previa?.estado} ahora={vista.estado} />

      <ScreenFooter>
        <Button variant={vista.terminada ? "sol" : "primary"} onClick={onSeguir}>
          {boton}
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
