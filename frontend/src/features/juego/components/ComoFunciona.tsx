import { useState } from "react";
import { Button, ChevronLeftIcon, Heading, IconButton, Meta, Pill, Screen, ScreenFooter, ScreenHeader, Stack, Text, cssVars } from "@/shared/ui";
import { GEMELOS } from "../api";

const COLUMNAS = 25;

/** A cada gemelo le toca un final, siempre el mismo (no es azar de verdad: es el dibujo de la explicación). */
const FINALES = Array.from({ length: GEMELOS }, (_, i) => {
  const r = ((i * 7919 + 104729) % 1000) / 1000;
  return r < 0.46 ? "mas" : r < 0.8 ? "igual" : "menos";
});
const CUENTA = { mas: FINALES.filter((f) => f === "mas").length, igual: FINALES.filter((f) => f === "igual").length, menos: FINALES.filter((f) => f === "menos").length };
const ORDENADOS = [...FINALES].sort((a, b) => "mas igual menos".indexOf(a) - "mas igual menos".indexOf(b));

const PASOS = [
  {
    titulo: "Este eres tú, hoy.",
    texto: "Tienes una duda de trabajo: ¿me cambio?, ¿pido aumento?, ¿emprendo? Nadie puede decirte cómo va a salir, porque depende de la decisión y también de la suerte.",
  },
  {
    titulo: `Te copiamos ${GEMELOS} veces.`,
    texto: `Son tus gemelos: ${GEMELOS} copias tuyas, con tu misma edad, tu sueldo y tu pega. Todos toman la misma decisión que estás pensando.`,
  },
  {
    titulo: "Cada uno vive 10 años con su propia suerte.",
    texto: "A uno lo ascienden, a otra la despiden, a otro le llega una oferta. Qué tan seguido pasa cada cosa sale de encuestas a trabajadores chilenos, como la de ingresos (ESI) y la de empleo (ENE) del INE. Cuando no hay dato, usamos un supuesto y lo marcamos.",
  },
  {
    titulo: "Juntamos los finales y te los mostramos.",
    texto: "Así ves qué pasa casi siempre, qué pasa a veces y qué tan bien o mal puede salir. No es una predicción de tu futuro: es el abanico de lo que le pasa a gente como tú.",
  },
  {
    titulo: "Después te toca a ti.",
    texto: "Eliges una opción y tiramos un dado: te toca vivir uno solo de esos caminos. Son 10 años, con decisiones nuevas cada año. Al final te comparas con tus gemelos.",
  },
];

/** Cómo funciona, en cinco pasos y con los gemelos a la vista: qué significa "simulamos 500 gemelos". */
export function ComoFunciona({ onListo, onVolver, textoListo = "Armar mi perfil" }: { onListo: () => void; onVolver: () => void; textoListo?: string }) {
  const [paso, setPaso] = useState(0);
  const ultimo = paso === PASOS.length - 1;
  const finales = paso >= 3 ? ORDENADOS : FINALES;
  return (
    <Screen gap={16}>
      <ScreenHeader
        left={
          <IconButton label={paso === 0 ? "Volver" : "Paso anterior"} onClick={() => (paso === 0 ? onVolver() : setPaso(paso - 1))}>
            <ChevronLeftIcon />
          </IconButton>
        }
        right={<Pill>Cómo funciona</Pill>}
      />

      <div className="jg-como" data-paso={paso} aria-hidden="true">
        <div className="jg-como-tu">
          <span />
          <b>Tú</b>
        </div>
        <div className="jg-como-gemelos" style={cssVars({ "--jg-cols": COLUMNAS })}>
          {finales.map((f, i) => (
            <i key={i} data-final={f} style={cssVars({ "--jg-i": (i % COLUMNAS) + Math.floor(i / COLUMNAS) })} />
          ))}
        </div>
        <div className="jg-como-dado">
          <span>⚄</span>
        </div>
      </div>

      <div className="jg-como-leyenda" data-visible={paso >= 2 && paso <= 3}>
        <span><i data-final="mas" />{paso >= 3 ? <b>{CUENTA.mas}</b> : null} terminan ganando más</span>
        <span><i data-final="igual" />{paso >= 3 ? <b>{CUENTA.igual}</b> : null} igual</span>
        <span><i data-final="menos" />{paso >= 3 ? <b>{CUENTA.menos}</b> : null} ganando menos</span>
      </div>

      <Stack gap={8} key={paso} className="vd-subir" aria-live="polite">
        <Meta>
          Paso {paso + 1} de {PASOS.length}
        </Meta>
        <Heading level={2} as="h1">
          {PASOS[paso].titulo}
        </Heading>
        <Text>{PASOS[paso].texto}</Text>
        {paso === 3 && <Text size="sm">Los números de este dibujo son un ejemplo. Los tuyos salen de tu perfil.</Text>}
      </Stack>

      <ScreenFooter>
        <div className="jg-como-pasos" aria-hidden="true">
          {PASOS.map((_, i) => (
            <i key={i} data-activo={i === paso} />
          ))}
        </div>
        <Button onClick={() => (ultimo ? onListo() : setPaso(paso + 1))}>{ultimo ? textoListo : "Siguiente"}</Button>
        {!ultimo && (
          <Button variant="quiet" onClick={onListo}>
            Saltar la explicación
          </Button>
        )}
      </ScreenFooter>
    </Screen>
  );
}
