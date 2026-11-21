import { BigNumber, Button, Heading, Meta, Pill, RangeCompare, Screen, ScreenHeader, Stack, StationTimeline, SunCard, Tag, Text, type Range } from "@/shared/ui";
import { aniosDe, cargoYSueldo, deCada10, plata, sinSueldo, situacion } from "../textos";
import type { Anio, Rango, Vista } from "../types";
import { LeyendaCalidad } from "./piezas";

/** Lo más importante del año, en una línea, para la línea de tiempo. */
function resumenDelAnio(a: Anio): string {
  const partes: string[] = [];
  // las que elegiste tú; los sorteos automáticos (a qué empleador entras) no van en el resumen
  for (const d of a.decisiones) if (d.opcion !== "sorteo") partes.push(`${d.opcion_nombre}: ${d.texto}`);
  for (const e of a.eventos) if (!e.rutina) partes.push(e.texto);
  if (partes.length === 0) partes.push("Un año sin noticias.");
  return `${partes.join(" ")}${a.fin ? ` Cierras con: ${cargoYSueldo(a.fin, true)}.` : ""}`;
}

/** El cierre: tu vida frente a los gemelos de tu primera decisión. Viene de "8 · Fin de la partida" del kit. */
export function CierrePantalla({ vista, onOtraVida, onCambiarPerfil }: { vista: Vista; onOtraVida: () => void; onCambiarPerfil: () => void }) {
  const cierre = vista.cierre!;
  const e = cierre.estado;
  const primera = cierre.primera_decision;
  const opciones = primera?.comparacion.opciones ?? [];
  const elegida = opciones.find((o) => o.opcion === primera?.elegida);
  const otras = opciones.filter((o) => o.opcion !== primera?.elegida);
  const tope = Math.max(cierre.sueldo_final, ...opciones.map((o) => o.sueldo.p90), 1) * 1.05;
  const pos = (n: number) => Math.min(100, Math.max(0, (n / tope) * 100));
  const aRango = (r: Rango): Range => ({ low: pos(r.p10), high: pos(r.p90), median: pos(r.p50) });
  const letra = (i: number) => String.fromCharCode(66 + i);
  const edadInicial = vista.edad_final - vista.anios;

  return (
    <Screen gap={28}>
      <Stack gap={12}>
        <ScreenHeader left={<Pill tone="sol">Fin de la partida</Pill>} right={<Meta>{vista.anios} años · {e.edad} años</Meta>} />
        <Heading level={1}>Diez años en la vida que elegiste.</Heading>
      </Stack>

      <SunCard>
        <Meta>{sinSueldo(e) ? "Tu último sueldo" : "Tu sueldo final"}</Meta>
        <BigNumber value={plata(cierre.sueldo_final)} unit="al mes" animate />
        <Text>
          Terminas a los {e.edad} años: {sinSueldo(e) ? situacion(e.estado).toLowerCase() : e.cargo}.{" "}
          {cierre.anios_sin_trabajo > 0
            ? `Pasaste ${cierre.anios_sin_trabajo} ${cierre.anios_sin_trabajo === 1 ? "año" : "años"} sin trabajo.`
            : "No pasaste ningún año sin trabajo."}
        </Text>
        {cierre.mejor_que_gemelos !== undefined && elegida && (
          <Text>
            <strong>
              Terminaste mejor que {deCada10(cierre.mejor_que_gemelos)} gemelos que también eligieron «{elegida.nombre}».
            </strong>
          </Text>
        )}
      </SunCard>

      {primera && elegida && (
        <Stack as="section" gap={12}>
          <Stack gap={4}>
            <Heading level={3} as="h2">
              Tu vida contra tus gemelos
            </Heading>
            <Text size="sm">
              Tu primera decisión: {primera.pregunta} Sueldo a los 10 años de los {primera.comparacion.gemelos} gemelos de cada opción. Cada barra va
              del 10% peor al 10% mejor; la raya es el gemelo del medio.
            </Text>
          </Stack>
          <Stack gap={6}>
            <span className="vd-camino">
              <Tag tone="sol">Tú</Tag>
              {plata(cierre.sueldo_final)}
            </span>
            <span className="vd-camino">
              <Tag tone="accent">A</Tag>
              {elegida.nombre} (la que elegiste) · {plata(elegida.sueldo.p10)} a {plata(elegida.sueldo.p90)}
            </span>
            {otras.map((o, i) => (
              <span className="vd-camino" key={o.opcion}>
                <Tag>{letra(i)}</Tag>
                {o.nombre} (la que no tomaste) · {plata(o.sueldo.p10)} a {plata(o.sueldo.p90)}
              </span>
            ))}
          </Stack>
          <Stack gap={12}>
            {otras.map((o, i) => (
              <Stack gap={5} key={o.opcion}>
                <RangeCompare indicator="dinero" label={`A contra ${letra(i)} · ${o.nombre}`} a={aRango(elegida.sueldo)} b={aRango(o.sueldo)} />
                <div className="vd-rangos" aria-hidden="true">
                  <em>Tú</em>
                  <span className="vd-rango-pista jg-pista-tu">
                    <span style={{ left: `${pos(cierre.sueldo_final)}%` }} />
                  </span>
                </div>
              </Stack>
            ))}
          </Stack>
          <Text>
            Ojo con la comparación: tú tomaste más decisiones en estos 10 años. Tus gemelos solo tomaron la primera y después dejaron que la vida
            siguiera sin buscar más cambios.
          </Text>
        </Stack>
      )}
      {!primera && <Text size="sm">Tu primera decisión tenía demasiadas opciones para simular gemelos, así que aquí no hay con quién compararte.</Text>}

      <Stack as="section" gap={10}>
        <Heading level={3} as="h2">
          Tus {vista.anios} años
        </Heading>
        <div className="jg-vivido">
          <StationTimeline stations={vista.historia.map((a) => ({ when: `${aniosDe(a.edad, a.fin?.edad, edadInicial)} · ${a.edad} años`, what: resumenDelAnio(a) }))} />
        </div>
      </Stack>

      <Stack gap={14}>
        <Button onClick={onOtraVida}>Jugar otra vida</Button>
        <Button variant="white" onClick={onCambiarPerfil}>
          Cambiar mi perfil
        </Button>
      </Stack>
      <LeyendaCalidad />
    </Screen>
  );
}
