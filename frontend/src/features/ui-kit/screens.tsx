/**
 * Las 8 pantallas del Claude Design armadas solo con componentes de @/shared/ui.
 * Datos de mentira: sirven de referencia para conectar el simulador de verdad.
 */
import { useState } from "react";
import {
  BigNumber,
  Button,
  ChevronLeftIcon,
  DecisionArt,
  DecisionList,
  DotLegend,
  Heading,
  IconButton,
  IndicatorGrid,
  INDICATORS,
  LifePathHero,
  LinesChart,
  Meta,
  MissedList,
  NightBand,
  Notification,
  OfficeScene,
  Panel,
  PeopleTally,
  Pill,
  RangeCompare,
  Row,
  Screen,
  ScreenFooter,
  ScreenHeader,
  Segmented,
  Slider,
  SlowReveal,
  Stack,
  StationTimeline,
  SunCard,
  Tag,
  Text,
  TravelScene,
  VisitsTimeline,
  YearTicker,
  ChipGroup,
  Narrative,
  indicatorColor,
  gate,
  type IndicatorValues,
  type IndicatorKey,
} from "@/shared/ui";

export type ScreenId = "inicio" | "gemelo" | "decision" | "viaje" | "oficina" | "tunel" | "evento" | "resumen";

export const SCREENS: { id: ScreenId; title: string }[] = [
  { id: "inicio", title: "1 · Inicio" },
  { id: "gemelo", title: "2 · Sobre ti" },
  { id: "decision", title: "3 · Decisión del año" },
  { id: "viaje", title: "4 · Work and travel" },
  { id: "oficina", title: "5 · Las noches largas" },
  { id: "tunel", title: "6 · Años sin decidir" },
  { id: "evento", title: "7 · Lo que no vuelve" },
  { id: "resumen", title: "8 · Fin de la partida" },
];

type Nav = { go: (id: ScreenId) => void };

const v = (dinero: number, carrera: number, bienestar: number, vida: number): IndicatorValues => ({ dinero, carrera, bienestar, vida });
const HOY = v(35, 30, 55, 70);
const TRAS_VIAJE = v(52, 38, 78, 52);
const TRAS_OFICINA = v(74, 71, 49, 33);

/* 1 · Inicio */
export function InicioScreen({ go }: Nav) {
  return (
    <Screen>
      <ScreenHeader left={<Pill>Simulador de vida</Pill>} right={<Meta>Partida 1</Meta>} />
      <LifePathHero />
      <Stack gap={12}>
        <Heading level={1}>Vive tu vida laboral antes de vivirla.</Heading>
        <Text>Cada año eliges tú. Antes de vivirlo ves lo que ganas, lo que cuesta y lo que te pierdes.</Text>
      </Stack>
      <Row gap={6}>
        <Tag>10 años en 5 minutos</Tag>
        <Tag>Una decisión por año</Tag>
        <Tag>Cada partida es distinta</Tag>
      </Row>
      <ScreenFooter>
        <Button onClick={() => go("gemelo")}>Empezar una vida</Button>
      </ScreenFooter>
    </Screen>
  );
}

/* 2 · Sobre ti */
const RASGOS = ["Entreno seguido", "Familia cerca", "Trabajo hasta tarde", "Quiero emprender", "Vivir afuera", "Mundo business"].map((l) => ({
  value: l,
  label: l,
}));
const DESDE_CLAUDE = ["Entreno seguido", "Familia cerca", "Trabajo hasta tarde", "Vivir afuera"];

export function GemeloScreen({ go }: Nav) {
  const [fuente, setFuente] = useState<"claude" | "manual">("claude");
  const [rasgos, setRasgos] = useState<string[]>(DESDE_CLAUDE);
  const [pesos, setPesos] = useState<Record<IndicatorKey, number>>({ dinero: 6, carrera: 5, bienestar: 4, vida: 5 });
  const [cadencia, setCadencia] = useState<"seis" | "ano">("ano");
  const total = Object.values(pesos).reduce((a, b) => a + b, 0);
  const pct = (n: number) => `${total > 0 ? Math.round((n / total) * 100) : 0} %`;

  return (
    <Screen>
      <ScreenHeader
        left={
          <IconButton label="Volver al inicio" onClick={() => go("inicio")}>
            <ChevronLeftIcon />
          </IconButton>
        }
        right={<Pill>Sobre ti</Pill>}
      />
      <Stack>
        <Heading level={1}>Cuéntanos de ti.</Heading>
        <Text>Con esto elegimos qué caminos mostrarte. Las decisiones las tomas tú.</Text>
      </Stack>
      <Segmented
        label="Cómo nos cuentas de ti"
        value={fuente}
        onChange={(f) => {
          setFuente(f);
          setRasgos(f === "claude" ? DESDE_CLAUDE : []);
        }}
        options={[
          { value: "claude", label: "Mi Claude ya sabe" },
          { value: "manual", label: "Lo lleno yo" },
        ]}
      />
      <Panel>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            {fuente === "claude" ? "Esto dice tu agente de ti" : "Marca lo que se parece a ti"}
          </Heading>
          <Text size="sm">
            {fuente === "claude"
              ? "Desmarca lo que no quieras usar. Nada sale de aquí sin que tú lo apruebes."
              : "Con tres o cuatro ya alcanza para empezar."}
          </Text>
        </Stack>
        <ChipGroup options={RASGOS} selected={rasgos} onChange={setRasgos} />
      </Panel>
      <Stack as="section" gap={10}>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            Reparte lo que te importa
          </Heading>
          <Text size="sm">Con esto medimos tu felicidad al final: qué tan cerca quedó tu vida de lo que elegiste aquí.</Text>
        </Stack>
        <Stack gap={6}>
          {INDICATORS.map(({ key, label }) => (
            <Slider
              key={key}
              label={label}
              value={pesos[key]}
              onChange={(n) => setPesos((p) => ({ ...p, [key]: n }))}
              color={indicatorColor(key)}
              display={pct(pesos[key])}
            />
          ))}
        </Stack>
      </Stack>
      <Stack as="section">
        <Heading level={3} as="h2">
          ¿Cada cuánto decides?
        </Heading>
        <Segmented
          label="Cada cuánto tomas una decisión"
          value={cadencia}
          onChange={setCadencia}
          options={[
            { value: "seis", label: "Cada 6 meses" },
            { value: "ano", label: "Cada año" },
          ]}
        />
      </Stack>
      <ScreenFooter>
        <Button onClick={() => go("decision")}>Empezar a decidir</Button>
      </ScreenFooter>
    </Screen>
  );
}

/* 3 · Decisión del año */
type Camino = "viaje" | "consultora" | "invertir" | "magister";

export function DecisionScreen({ go }: Nav) {
  const [sel, setSel] = useState<Camino>("viaje");
  return (
    <Screen gap={16}>
      <ScreenHeader left={<Pill>2027 · 23 años</Pill>} right={<Meta>Turno 1 de 10</Meta>} />
      <IndicatorGrid label="Cómo estás hoy" values={HOY} />
      <Stack gap={6} style={{ marginTop: 4 }}>
        <Heading level={2} as="h1">
          Saliste de la universidad. ¿Y ahora?
        </Heading>
        <Meta>4 caminos de 37 · elegidos para ti</Meta>
      </Stack>
      <DecisionList<Camino>
        label="Caminos posibles"
        value={sel}
        onChange={setSel}
        options={[
          {
            id: "viaje",
            art: <DecisionArt kind="viaje" />,
            title: "Irte de work and travel",
            subtitle: "Un año en Australia: cosechar, servir café, viajar.",
            tags: [{ label: "Para ti", tone: "accent" }, { label: "+ Bienestar" }, { label: "− Familia", tone: "minus" }],
          },
          {
            id: "consultora",
            art: <DecisionArt kind="consultora" />,
            title: "Entrar a una consultora grande",
            subtitle: "Se aprende rápido y se duerme poco.",
            tags: [{ label: "+ Carrera" }, { label: "+ Dinero" }, { label: "− Vida personal", tone: "minus" }],
          },
          {
            id: "invertir",
            art: <DecisionArt kind="invertir" />,
            title: "Invertir por tu cuenta",
            subtitle: "Tus ahorros en acciones. Puede salir muy bien o muy mal.",
            tags: [{ label: "Apuesta", tone: "sol" }, { label: "± Dinero" }],
          },
          {
            id: "magister",
            art: <DecisionArt kind="magister" />,
            title: "Hacer un magíster en Canadá",
            subtitle: "Dos años afuera. Vuelves con otro techo.",
            tags: [{ label: "+ Carrera" }, { label: "− Familia", tone: "minus" }, { label: "− Dinero", tone: "minus" }],
          },
        ]}
      />
      <ScreenFooter>
        <Button onClick={() => go(sel === "viaje" ? "viaje" : "oficina")}>Vivir este año</Button>
      </ScreenFooter>
    </Screen>
  );
}

/* 4 · Work and travel */
export function ViajeScreen({ go }: Nav) {
  return (
    <Screen scene="once" gap={14}>
      <ScreenHeader left={<Pill>2027 · 23 años</Pill>} right={<Meta>Work and travel</Meta>} />
      <TravelScene />
      <Stack gap={6}>
        <Heading level={2} as="h1">
          Un año al otro lado del mundo.
        </Heading>
        <Text>Cosechaste cerezas en Tasmania, serviste café en Sídney y cruzaste el sudeste asiático con una mochila.</Text>
      </Stack>
      <IndicatorGrid label="Cómo cambió tu vida este año" values={TRAS_VIAJE} previous={HOY} revealAt={0.62} />
      <NightBand {...gate(0.7, "sube")}>
        <Meta>Lo que te perdiste</Meta>
        <MissedList items={["La Navidad en la casa de tus papás", "Los 80 de tu abuela"]} revealAt={0.73} />
      </NightBand>
      <ScreenFooter>
        <Button onClick={() => go("oficina")}>Seguir a 2028</Button>
      </ScreenFooter>
    </Screen>
  );
}

/* 5 · Las noches largas */
export function OficinaScreen({ go }: Nav) {
  return (
    <Screen tone="noche" scene="once" gap={14}>
      <ScreenHeader left={<Pill>2028 · 24 años</Pill>} right={<Meta>Consultora · Santiago</Meta>} />
      <OfficeScene />
      <Stack gap={6}>
        <Heading level={2} as="h1">
          Las noches largas.
        </Heading>
        <Text>Subiste rápido: eres quien siempre está. Afuera, la vida siguió sin ti.</Text>
      </Stack>
      <Stack gap={8} aria-label="Mensajes que no alcanzaste a contestar">
        <Notification from="Los cabros" initial="C" message="¿Vienes al asado? Ya prendimos." time="21:10" revealAt={0.2} />
        <Notification from="Mamá" message="Te guardé torta del cumpleaños." time="22:30" revealAt={0.3} />
        <Notification from="Papá" message="¿Almorzamos el domingo?" time="23:05" revealAt={0.38} />
      </Stack>
      <IndicatorGrid label="Cómo cambió tu vida este año" values={TRAS_OFICINA} previous={TRAS_VIAJE} revealAt={0.62} />
      <ScreenFooter>
        <Button onClick={() => go("tunel")}>Seguir trabajando</Button>
      </ScreenFooter>
    </Screen>
  );
}

/* 6 · Años sin decidir */
export function TunelScreen({ go }: Nav) {
  return (
    <Screen tone="noche" gap={14}>
      <ScreenHeader left={<Pill>2029 → 2031</Pill>} right={<Meta>Sin decisiones</Meta>} />
      <Stack gap={6}>
        <YearTicker years={[2029, 2030, 2031]} />
        <Heading level={2} as="h1">
          Dos años sin levantar la cabeza.
        </Heading>
        <Text>Querías ser el mejor, y lo fuiste. No tomaste ninguna decisión: el trabajo las tomó por ti.</Text>
      </Stack>
      <Stack as="section" gap={8}>
        <Meta>Estaciones donde no paraste</Meta>
        <StationTimeline
          stations={[
            { when: "Mar 2029", what: "Te ofrecieron cambiarte de área" },
            { when: "Sep 2029", what: "Tu pareja propuso irse a vivir juntos" },
            { when: "Mar 2030", what: "Un amigo te invitó a su proyecto" },
            { when: "Sep 2030", what: "Volver al fútbol de los martes" },
          ]}
        />
      </Stack>
      <IndicatorGrid label="Cómo cambió tu vida en estos dos años" values={v(85, 88, 41, 24)} previous={v(74, 71, 49, 33)} />
      <ScreenFooter>
        <Button variant="sol" onClick={() => go("evento")}>
          Levantar la cabeza
        </Button>
      </ScreenFooter>
    </Screen>
  );
}

/* 7 · Lo que no vuelve */
export function EventoScreen({ go }: Nav) {
  return (
    <Screen tone="noche" wide gap={24}>
      <Meta>Agosto 2031 · 27 años</Meta>
      <Stack gap={16}>
        <SlowReveal delay={0.3}>
          <Narrative>Tu abuela se enfermó en junio. Pensaste que iba a salir bien.</Narrative>
        </SlowReveal>
        <SlowReveal delay={1.8}>
          <Narrative>Ibas a ir el fin de semana. Hubo cierre de proyecto.</Narrative>
        </SlowReveal>
        <SlowReveal delay={3.3}>
          <Narrative strong>Falleció un martes. Estabas en la oficina.</Narrative>
        </SlowReveal>
      </Stack>
      <SlowReveal delay={4.8} className="vd-pila" style={{ gap: 10 }}>
        <Meta>Desde que saliste de la universidad</Meta>
        <BigNumber value={2} unit="veces la viste" />
        <VisitsTimeline
          label="Línea de tiempo de 2027 a 2031: dos visitas a tu abuela y seis invitaciones a las que no fuiste"
          startYear={2027}
          endYear={2031}
          seen={[2029, 2030.25]}
          missed={[2027.95, 2028.5, 2029.75, 2030, 2030.95, 2031.35]}
          end={2031.6}
        />
        <DotLegend
          items={[
            { kind: "seen", label: "La viste" },
            { kind: "missed", label: "Te invitaron y no fuiste" },
            { kind: "end", label: "Agosto 2031" },
          ]}
        />
      </SlowReveal>
      <SlowReveal delay={6} className="vd-pie">
        <Heading level={3} as="h2">
          ¿Lo harías igual?
        </Heading>
        <Button variant="quiet" onClick={() => go("resumen")} style={{ background: "var(--tinta)", color: "var(--papel)" }}>
          Seguir con esta vida
        </Button>
        <Button variant="quiet" onClick={() => go("decision")}>
          Volver a 2027 y elegir distinto
        </Button>
      </SlowReveal>
    </Screen>
  );
}

/* 8 · Fin de la partida */
export function ResumenScreen({ go }: Nav) {
  return (
    <Screen gap={28}>
      <Stack gap={12}>
        <ScreenHeader left={<Pill tone="sol">Fin de la partida</Pill>} right={<Meta>2027 – 2037</Meta>} />
        <Heading level={1}>Diez años en la vida que elegiste.</Heading>
      </Stack>
      <SunCard>
        <Meta>Tu felicidad</Meta>
        <BigNumber value={61} unit="/ 100" animate />
        <Text>Qué tan cerca quedó esta vida de lo que dijiste que te importaba. Tu vida personal pesaba un 25 %: fue lo que más bajó.</Text>
      </SunCard>
      <Stack as="section" gap={10}>
        <Heading level={3} as="h2">
          Diez años en cuatro líneas
        </Heading>
        <LinesChart
          label="Evolución de 2027 a 2037: dinero y carrera suben y se quedan arriba; bienestar y vida personal caen en los primeros años y se recuperan poco"
          startYear={2027}
          endYear={2037}
          band={{ from: 2, to: 4, label: "Túnel" }}
          marker={{ at: 4.57, label: "Agosto 2031" }}
          series={{
            dinero: [35, 52, 74, 80, 85, 84, 86, 88, 90, 91, 92],
            carrera: [30, 38, 71, 80, 88, 84, 80, 78, 76, 75, 74],
            bienestar: [55, 78, 49, 45, 41, 38, 44, 46, 45, 47, 48],
            vida: [70, 52, 33, 28, 24, 22, 30, 34, 33, 35, 36],
          }}
        />
      </Stack>
      <Stack as="section" gap={14}>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            Cuánto viste a tu gente
          </Heading>
          <Text size="sm">Cada punto es una vez en diez años.</Text>
        </Stack>
        <PeopleTally who="Tus papás" seen={14} missed={26} />
        <PeopleTally who="Tu abuela" seen={2} missed={6} end />
        <PeopleTally who="Los cabros del colegio" seen={9} missed={21} unit="juntas" />
        <DotLegend
          items={[
            { kind: "seen", label: "Fuiste" },
            { kind: "missed", label: "Te invitaron y no fuiste" },
          ]}
        />
      </Stack>
      <Stack as="section" gap={12}>
        <Stack gap={4}>
          <Heading level={3} as="h2">
            Esta vida contra otra
          </Heading>
          <Text size="sm">20 partidas de cada camino. Barra angosta: camino seguro. Barra ancha: apuesta.</Text>
        </Stack>
        <Stack gap={6}>
          <span className="vd-camino">
            <Tag tone="accent">A</Tag>Australia y consultora (tu partida)
          </span>
          <span className="vd-camino">
            <Tag>B</Tag>Empresa mediana en Santiago
          </span>
        </Stack>
        <Stack gap={12}>
          <RangeCompare indicator="dinero" a={{ low: 70, high: 95, median: 88 }} b={{ low: 45, high: 70, median: 58 }} />
          <RangeCompare indicator="carrera" a={{ low: 60, high: 90, median: 76 }} b={{ low: 45, high: 75, median: 60 }} />
          <RangeCompare indicator="bienestar" a={{ low: 25, high: 60, median: 46 }} b={{ low: 55, high: 80, median: 68 }} />
          <RangeCompare indicator="vida" a={{ low: 15, high: 50, median: 34 }} b={{ low: 60, high: 85, median: 74 }} />
        </Stack>
        <Text>El camino B gana menos, pero en ninguna de sus 20 partidas te quedas sin tu gente.</Text>
      </Stack>
      <Stack gap={14}>
        <Button onClick={() => go("decision")}>Jugar otra vida</Button>
        <Button variant="white" onClick={() => go("inicio")}>
          Volver al inicio
        </Button>
      </Stack>
      <Text size="sm" style={{ marginTop: "auto" }}>
        Prototipo: estos números están inventados. Dinero y Carrera se van a apoyar en datos reales; Bienestar y Vida personal son reglas simples, y el juego lo va a decir.
      </Text>
    </Screen>
  );
}

export const SCREEN_COMPONENTS: Record<ScreenId, (p: Nav) => JSX.Element> = {
  inicio: InicioScreen,
  gemelo: GemeloScreen,
  decision: DecisionScreen,
  viaje: ViajeScreen,
  oficina: OficinaScreen,
  tunel: TunelScreen,
  evento: EventoScreen,
  resumen: ResumenScreen,
};
