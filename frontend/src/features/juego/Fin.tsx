import { useEffect, useState } from "react";
import { api } from "@/shared/api";
import { clpCorto } from "@/shared/lib/format";
import type { Calibracion, Epilogo, Identidad, Perfil, Prioridades, Suerte, Turno } from "@/shared/types";
import { Button, Heading, LinesChart, Meta, Panel, Pill, Row, Screen, ScreenHeader, Stack, Tag, Text } from "@/shared/ui";
import { atributos, logros, veredicto, type Contadores } from "./carrera";
import { ANIO_0, anioDe } from "./comun";

type Props = {
  turno: Turno;
  perfil: Perfil;
  prioridades: Prioridades;
  identidad: Identidad;
  mundo: string;
  semilla: number;
  diaria: boolean;
  contadores: Contadores;
  historia: string[];
  conClaude: boolean;
  onOtraVida: (diaria: boolean) => void;
  onInicio: () => void;
};

/** Fin de la carrera: tu carta, tus empresas, la década en cuatro líneas y tu suerte entre cientos de vidas tuyas. */
export function Fin({ turno, perfil, prioridades, identidad, mundo, semilla, diaria, contadores: c, historia, conClaude, onOtraVida, onInicio }: Props) {
  const [suerte, setSuerte] = useState<Suerte | null>(null);
  const [epilogo, setEpilogo] = useState<Epilogo | null>(null);
  const [cal, setCal] = useState<Calibracion | null>(null);
  const [copiado, setCopiado] = useState(false);
  const r = turno.resumen!;
  const anios = turno.anios;
  const sueldo0 = perfil.estado === "empleado" ? perfil.sueldo : 0;
  const v = veredicto(anios, c, sueldo0, r.felicidad);
  const attrs = atributos(anios);
  const medallas = logros(anios, c, sueldo0);

  useEffect(() => {
    api
      .suerte({ perfil, prioridades, identidad, mundo, semilla, felicidad: r.felicidad, sueldo_final: r.sueldo_final, ingreso_acumulado: r.ingreso_acumulado })
      .then(setSuerte)
      .catch(() => undefined);
    if (conClaude)
      api
        .epilogo({ perfil, identidad, camino: `Su carrera: ${v.titulo}. ${v.por}`, mundo: turno.mundo.nombre, historia, resumen: r, anio_final: anioDe(anios.length - 1) })
        .then((x) => setEpilogo(x.epilogo))
        .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const serie = (k: "dinero" | "carrera" | "bienestar" | "vida_personal") => [anios[0].indicadores_inicio[k], ...anios.map((a) => a.indicadores[k])];
  const clubes = c.clubes.map((x) => ({ when: x.anio < 0 ? "Hoy" : String(anioDe(x.anio)), what: x.cargo ? `${x.nombre} · ${x.cargo}` : x.nombre }));
  const texto = `Mi carrera en BiforkStrange: ${v.titulo} · media ${Math.round(r.felicidad)} · ${c.empresas} empresas · sueldo máx ${clpCorto(c.sueldoMax)}${
    suerte ? ` · mejor que el ${Math.round(suerte.percentil_felicidad)}% de mis vidas posibles` : ""
  }${diaria ? " (vida del día)" : ""}`;

  return (
    <Screen gap={24}>
      <ScreenHeader
        left={<Pill tone="sol">{diaria ? "Vida del día" : "Fin de la carrera"}</Pill>}
        right={
          <Meta>
            {ANIO_0} – {ANIO_0 + anios.length}
          </Meta>
        }
      />

      <div className="vd-carta" role="group" aria-label="Tu carta de carrera">
        <div className="vd-carta-top">
          <div className="vd-carta-media">
            <b>{Math.round(r.felicidad)}</b>
            <span>Media</span>
          </div>
          <div>
            <div className="vd-carta-veredicto">{v.titulo}</div>
            <div className="vd-carta-sub">{v.por}</div>
          </div>
        </div>
        <div className="vd-carta-attrs">
          {Object.entries(attrs).map(([k, n]) => (
            <div key={k}>
              <b>{n}</b>
              <span>{k}</span>
            </div>
          ))}
        </div>
        <div className="vd-carta-stats">
          {(
            [
              [String(c.empresas), "Empresas"],
              [String(c.ascensos), "Ascensos"],
              [String(c.sinPega), "Años sin pega"],
              [clpCorto(c.sueldoMax), "Sueldo máx"],
              [clpCorto(r.ingreso_acumulado), "Ganado"],
              [clpCorto(r.ahorro_final), "Ahorro"],
            ] as const
          ).map(([n, l]) => (
            <div key={l}>
              <b>{n}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </div>

      <Text>
        {suerte
          ? `Te fue mejor que al ${Math.round(suerte.percentil_felicidad)} % de ${suerte.n} vidas tuyas: mismo punto de partida, mismo mundo, decidiendo como tú. ${
              suerte.percentil_sueldo >= 50 ? `Tu sueldo final le gana al ${Math.round(suerte.percentil_sueldo)} %.` : `Tu sueldo final le gana solo al ${Math.round(suerte.percentil_sueldo)} %.`
            }`
          : "Comparando tu carrera con cientos de vidas tuyas…"}
      </Text>

      {medallas.length > 0 && (
        <Stack as="section" gap={8}>
          <Heading level={3} as="h2">
            Lo que ganaste
          </Heading>
          <Row gap={6}>
            {medallas.map((m) => (
              <Tag key={m} tone="sol">
                {m}
              </Tag>
            ))}
          </Row>
        </Stack>
      )}

      <Stack as="section" gap={8}>
        <Heading level={3} as="h2">
          Tus empresas
        </Heading>
        <div className="vd-recap">
          {clubes.map((x, i) => (
            <div className="vd-recap-linea" key={i}>
              <i className={i === clubes.length - 1 ? "bueno" : "neutro"}>{i === clubes.length - 1 ? "●" : "○"}</i>
              <span>
                <Meta>{x.when}</Meta> {x.what}
              </span>
            </div>
          ))}
        </div>
      </Stack>

      {epilogo && (
        <Stack as="section" gap={10}>
          <Heading level={3} as="h2">
            {epilogo.titulo}
          </Heading>
          {epilogo.historia.split(/\n\s*\n/).map((x, i) => (
            <Text key={i}>{x}</Text>
          ))}
          <Panel>
            <Meta>Tu CV en {anioDe(anios.length - 1)}</Meta>
            <ul className="vd-cv">
              {epilogo.cv.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          </Panel>
        </Stack>
      )}

      <Stack as="section" gap={8}>
        <Heading level={3} as="h2">
          Diez años en cuatro líneas
        </Heading>
        <LinesChart
          label="Evolución de tus cuatro barras en la década"
          startYear={ANIO_0}
          endYear={ANIO_0 + anios.length}
          series={{ dinero: serie("dinero"), carrera: serie("carrera"), bienestar: serie("bienestar"), vida: serie("vida_personal") }}
        />
      </Stack>

      <Stack gap={12}>
        <Button variant="sol" onClick={() => navigator.clipboard?.writeText(texto).then(() => setCopiado(true)).catch(() => undefined)}>
          {copiado ? "Copiada: pégala donde quieras" : "Copiar mi carta"}
        </Button>
        <Button onClick={() => onOtraVida(false)}>Jugar otra vida</Button>
        <Button variant="white" onClick={() => onOtraVida(true)}>
          Vida del día: la misma suerte para todos hoy
        </Button>
        <Button variant="quiet" onClick={onInicio}>
          Volver al inicio
        </Button>
      </Stack>

      <Stack gap={8}>
        <Text size="sm">
          Las empresas son reales (SII, Get on Board, Y Combinator, empleospublicos.cl). Lo que pasa y con qué probabilidad lo calcula el simulador con datos de Chile
          (ESI 2025, EPS 2024). Bienestar y Vida personal son reglas simples. La media es qué tan cerca quedó tu vida de lo que te importa.
        </Text>
        {cal ? (
          <Text size="sm">
            Para revisar el simulador jugamos {cal.cohorte.personas.toLocaleString("es-CL")} carreras solas: reproducen {cal.calzan} de {cal.total} indicadores de Chile.
          </Text>
        ) : (
          <Button variant="quiet" onClick={() => api.calibracion().then(setCal).catch(() => undefined)}>
            ¿Por qué creerle a los números?
          </Button>
        )}
      </Stack>
    </Screen>
  );
}
