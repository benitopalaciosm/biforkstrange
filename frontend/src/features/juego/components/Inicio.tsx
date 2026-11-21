import { Button, Heading, LifePathHero, Meta, Pill, Row, Screen, ScreenFooter, ScreenHeader, Stack, Tag, Text, cssVars } from "@/shared/ui";
import { GEMELOS } from "../api";
import { Cargando, ErrorCaja } from "./piezas";

/** Portada. Viene de la pantalla "1 · Inicio" del kit. */
export function Inicio({
  hayPartida,
  cargando,
  error,
  onEmpezar,
  onContinuar,
}: {
  hayPartida: boolean;
  cargando: boolean;
  error: string | null;
  onEmpezar: () => void;
  onContinuar: () => void;
}) {
  return (
    <Screen>
      <ScreenHeader left={<Pill>Gemelo laboral</Pill>} right={<Meta>10 años</Meta>} />
      <LifePathHero past={["Estudios", "Tu pega"]} today="Tú, hoy" chosen="Lo que eliges" alternatives={["Otra opción", "Seguir igual"]} />
      <Stack gap={12}>
        <Heading level={1}>Vive tu decisión antes de tomarla.</Heading>
        <Text>
          Trae la duda de trabajo que te da vueltas. Hacemos {GEMELOS} copias tuyas, tus gemelos, y cada una vive 10 años con esa decisión y con su
          propia suerte. Así ves qué pasa casi siempre y qué pasa a veces, antes de jugártela tú.
        </Text>
      </Stack>
      <div className="jg-mini" aria-hidden="true">
        {Array.from({ length: 100 }, (_, i) => (
          <i key={i} data-final={((i * 7919 + 104729) % 1000) / 1000 < 0.46 ? "mas" : ((i * 7919 + 104729) % 1000) / 1000 < 0.8 ? "igual" : "menos"} style={cssVars({ "--jg-i": i })} />
        ))}
      </div>
      <Row gap={6}>
        <Tag>1 · Cuentas quién eres</Tag>
        <Tag>2 · Tus gemelos prueban cada opción</Tag>
        <Tag>3 · Eliges y tiramos el dado</Tag>
      </Row>
      <ScreenFooter>
        {error && <ErrorCaja error={error} />}
        {cargando && <Cargando>Retomando tu partida…</Cargando>}
        {hayPartida && (
          <Button onClick={onContinuar} disabled={cargando}>
            Seguir mi partida
          </Button>
        )}
        <Button variant={hayPartida ? "white" : "primary"} onClick={onEmpezar} disabled={cargando}>
          {hayPartida ? "Empezar otra vida" : "Empezar"}
        </Button>
        <div className="jg-enlaces">
          <a href="/simulacion" className="vd-meta">
            Simulación anterior
          </a>
          <a href="/ui" className="vd-meta">
            Kit de UI
          </a>
        </div>
      </ScreenFooter>
    </Screen>
  );
}
