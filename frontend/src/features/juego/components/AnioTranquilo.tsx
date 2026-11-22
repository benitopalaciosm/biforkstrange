import { useState } from "react";
import { Button, Heading, Meta, Pill, Screen, ScreenFooter, ScreenHeader, Stack, Text } from "@/shared/ui";
import type { Eleccion, Vista } from "../types";

/**
 * Un año en que no te llegó nada. No te obliga a decidir ni te pone una lista: te hace una propuesta,
 * la que más se le plantea a gente como tú, con un dato real. Dices sí o sigues igual.
 * Quien quiere hacer otra cosa puede abrir la lista completa.
 */
export function AnioTranquilo({ vista, cargando, error, onElegir }: {
  vista: Vista;
  cargando: boolean;
  error: string | null;
  onElegir: (e: Eleccion) => void;
}) {
  const [verTodo, setVerTodo] = useState(false);
  const p = vista.pendiente!;
  const s = p.sugerencia;
  const anio = Math.min(vista.anio + 1, vista.anios);
  const otras = p.opciones.filter((o) => o.opcion !== "seguir" && o.opcion !== s?.decision);
  const elegir = (opcion: string) => onElegir({ decision: p.decision, opcion });

  return (
    <Screen gap={16}>
      <ScreenHeader left={<Pill style={{ whiteSpace: "nowrap" }}>Año {anio} · {vista.estado.edad} años</Pill>} right={<Meta>{anio} de {vista.anios}</Meta>} />
      <Stack gap={8} className="vd-subir">
        <Meta>Un año tranquilo</Meta>
        <Heading level={2} as="h1">
          Este año no te llegó ninguna propuesta.
        </Heading>
      </Stack>

      {s && (
        <div className="jg-propuesta vd-subir">
          <span className="jg-propuesta-eti">Algo que gente como tú se plantea este año</span>
          <b>{s.pregunta}</b>
          {s.dato && (
            <span className="jg-propuesta-dato">
              <strong>{s.es_frecuencia ? "Dato oficial: " : "Un dato: "}</strong>
              {s.dato}
              {s.fuente && <small> · {s.fuente}</small>}
            </span>
          )}
          <div className="jg-propuesta-botones">
            <Button onClick={() => elegir(s.decision)} disabled={cargando}>
              Sí, quiero ver cómo me iría
            </Button>
          </div>
        </div>
      )}

      {verTodo && (
        <div className="jg-tranquilo vd-subir" role="list" aria-label="Otras cosas que puedes hacer este año">
          {otras.map((o) => (
            <button key={o.opcion} type="button" role="listitem" className="jg-tranquilo-op" disabled={cargando} onClick={() => elegir(o.opcion)}>
              <b>{o.nombre}</b>
              <span>{o.detalle}</span>
            </button>
          ))}
        </div>
      )}

      {error && <Text size="sm">{error}</Text>}
      <ScreenFooter>
        <Button variant={s ? "quiet" : undefined} onClick={() => elegir("seguir")} disabled={cargando}>
          Seguir igual este año
        </Button>
        {!verTodo && otras.length > 0 && (
          <button type="button" className="ob-link" onClick={() => setVerTodo(true)}>
            Ver más cosas que podrías hacer
          </button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
