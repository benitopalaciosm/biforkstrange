import { useState } from "react";
import {
  Button, ChevronLeftIcon, DecisionArt, DecisionList, Heading, IconButton, Meta, Pill, Screen, ScreenHeader, Stack, Text, cssVars,
} from "@/shared/ui";
import { GEMELOS } from "../api";
import { CALIDAD, arte } from "../textos";
import type { Duda } from "../types";
import { Cargando, ErrorCaja } from "./piezas";

/** Tu duda: la decisión que te trajo. Viene de la lista de caminos de "3 · Decisión del año" del kit. */
export function DudaPicker({
  dudas,
  sugerida = null,
  cargando,
  error,
  onVolver,
  onElegir,
}: {
  dudas: Duda[] | null;
  /** La duda que trajo el documento de tu Claude: va primera y elegida. */
  sugerida?: string | null;
  cargando: boolean;
  error: string | null;
  onVolver: () => void;
  onElegir: (decision: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(sugerida);
  const orden = dudas && sugerida ? [...dudas].sort((a, b) => Number(b.decision === sugerida) - Number(a.decision === sugerida)) : dudas;
  const simulando = cargando && dudas !== null;
  return (
    <Screen gap={16}>
      <ScreenHeader
        left={
          <IconButton label="Volver a tu perfil" onClick={onVolver}>
            <ChevronLeftIcon />
          </IconButton>
        }
        right={<Pill>Tu duda</Pill>}
      />
      <Stack gap={6}>
        <Heading level={1}>¿Qué duda te trajo?</Heading>
        <Text>
          {sugerida && dudas?.some((d) => d.decision === sugerida)
            ? "Tu Claude eligió la primera; cámbiala si quieres. Es la primera carta de tu partida."
            : "Elige la que más se parece. Es la primera carta de tu partida."}
        </Text>
        {dudas && <Meta>{dudas.length} dudas posibles para tu perfil</Meta>}
      </Stack>
      {cargando && !dudas && <Cargando>Buscando las dudas que calzan contigo…</Cargando>}
      {dudas && dudas.length === 0 && <Text>Con este perfil no hay dudas disponibles. Vuelve y cámbialo.</Text>}
      {dudas && dudas.length > 0 && (
        <DecisionList<string>
          label="Dudas posibles"
          value={sel}
          onChange={setSel}
          options={(orden ?? dudas).map((d) => ({
            id: d.decision,
            art: <DecisionArt kind={arte(d.categoria)} />,
            title: d.nombre,
            subtitle: d.pregunta,
            tags: [...(d.decision === sugerida ? [{ label: "La eligió tu Claude", tone: "sol" as const }] : []), { label: d.categoria }, { label: CALIDAD[d.calidad]?.nombre ?? d.calidad, tone: d.calidad === "supuesto" ? "minus" : "default" }],
          }))}
        />
      )}
      <div className="jg-pie-fijo">
        {error && <ErrorCaja error={error} />}
        {simulando && (
          <>
            <div className="jg-viviendo" aria-hidden="true">
              {Array.from({ length: 40 }, (_, i) => (
                <i key={i} style={cssVars({ "--jg-i": i })} />
              ))}
            </div>
            <Cargando>Tus {GEMELOS} gemelos están viviendo 10 años con cada opción…</Cargando>
          </>
        )}
        <Button onClick={() => sel && onElegir(sel)} disabled={!sel || cargando}>
          {simulando ? "Simulando…" : "Ver a mis gemelos"}
        </Button>
      </div>
    </Screen>
  );
}
