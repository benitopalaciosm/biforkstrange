import type { Anio, AnioNarrado } from "@/shared/types";
import { BigNumber, Button, Heading, Meta, Narrative, Screen, SlowReveal, Stack, Text } from "@/shared/ui";
import { ANIO_0, anioDe } from "./comun";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/** Un golpe de la vida (despido, cierre, colapso), contado de a poco, con la cifra real que lo pone en contexto. */
export function Momento({ anio, narrado, onSeguir, onOtraVez }: { anio: Anio; narrado: AnioNarrado | undefined; onSeguir: () => void; onOtraVez: () => void }) {
  const m = anio.momento!;
  const golpe = anio.eventos.find((x) => x.tono === "malo" && !x.silencioso && x.id !== "recesion");
  const lineas = narrado?.momento.length ? narrado.momento : [golpe?.texto ?? "Pasó lo que no esperabas."];
  const mes = MESES[(anio.t * 5 + 7) % 12];
  const fin = 0.2 + lineas.length * 1.1;
  return (
    <Screen tone="noche" wide gap={24}>
      <Meta>
        {mes} {anioDe(anio.t)} · {anio.edad} años
      </Meta>
      <Stack gap={16}>
        {lineas.map((l, i) => (
          <SlowReveal key={i} delay={0.2 + i * 1.1}>
            <Narrative strong={i === lineas.length - 1}>{l}</Narrative>
          </SlowReveal>
        ))}
      </Stack>
      <SlowReveal delay={fin} className="vd-pila" style={{ gap: 10 }}>
        <Meta>El dato</Meta>
        <BigNumber value={m.unidad === "%" ? `${String(m.valor).replace(".", ",")} %` : String(m.valor).replace(".", ",")} unit={m.unidad === "%" ? undefined : m.unidad} />
        <Text>{m.texto.charAt(0).toUpperCase() + m.texto.slice(1)}.</Text>
        <span className="vd-fuente">Fuente: {m.fuente}</span>
      </SlowReveal>
      <SlowReveal delay={fin + 0.8} className="vd-pie">
        <Heading level={3} as="h2">
          ¿Lo harías igual?
        </Heading>
        <Button variant="quiet" onClick={onSeguir} style={{ background: "var(--tinta)", color: "var(--papel)" }}>
          Seguir con esta vida
        </Button>
        <Button variant="quiet" onClick={onOtraVez}>
          Volver a {ANIO_0} y jugar otra vida
        </Button>
      </SlowReveal>
    </Screen>
  );
}
