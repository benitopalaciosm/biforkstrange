import { Button, Heading, LifePathHero, Meta, Pill, Row, Screen, ScreenFooter, ScreenHeader, Stack, Tag, Text } from "@/shared/ui";
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
          Trae la duda de trabajo que te da vueltas. Te mostramos cómo les fue en 10 años a {GEMELOS} gemelos tuyos con cada opción:
          misma persona, misma decisión, otra suerte.
        </Text>
      </Stack>
      <Row gap={6}>
        <Tag>{GEMELOS} gemelos por opción</Tag>
        <Tag>Sueldo, cargo y cesantía</Tag>
        <Tag>Tú eliges, el dado decide</Tag>
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
