import { useState } from "react";
import { clpCorto } from "@/shared/lib/format";
import type { AnioNarrado, Caso, Identidad, Opcion, Suceso, Turno } from "@/shared/types";
import { Button, DecisionArt, DecisionList, Heading, IndicatorGrid, Meta, Pill, Screen, ScreenFooter, ScreenHeader, Stack, Text, type DecisionTag } from "@/shared/ui";
import type { Contadores } from "./carrera";
import { aKit, anioDe, arte, etiquetas } from "./comun";

/** Nombre de una carta de vida cuando aparece en el mercado («Pedirlo» solo no dice nada). */
const CARTA: Record<string, Record<string, string>> = {
  pedir_aumento: { pedir: "Pedir un aumento" },
  magister: { vespertino: "Hacer un magíster de noche" },
  bootcamp: { hacer: "Hacer un bootcamp" },
  emigrar: { irse: "Irte a trabajar a Estados Unidos" },
  sabatico: { irse: "Tomarte un año sabático" },
  emprender: { emprender: "Renunciar y emprender", lado: "Emprender en paralelo" },
  trabajar_mas_horas: { si: "Sumarte a las 55 horas del equipo" },
  jefatura: { aceptar: "Aceptar la jefatura" },
  renunciar: { renunciar: "Renunciar sin tener otra pega" },
  pedir_hibrido: { pedir: "Pedir trabajo híbrido" },
  media_jornada: { pedir: "Pedir media jornada" },
  aprender_ia: { aprender: "Aprender a trabajar con IA" },
  invertir_en_red: { si: "Hacer red: eventos, cafés, LinkedIn" },
  ahorro: { mucho: "Ahorrar el 20% del sueldo", gastar: "Darte gustos este año" },
  comprar_vivienda: { comprar: "Comprar tu depa" },
  tener_hijo: { si: "Buscar un hijo" },
  formalizar_pareja: { convivir: "Irse a vivir juntos", casarse: "Casarse" },
  separarse: { terminar: "Terminar la relación" },
  buscar_pareja: { si: "Salir a conocer gente" },
  volver_a_estudiar: { estudiar: "Sacar un título de noche" },
  volver_a_chile: { volver: "Volver a Chile" },
  cesantia: { nivel: "Esperar algo de tu nivel", rapido: "Tomar lo primero que salga", bootcamp: "Reconvertirte con un bootcamp", emprender: "Emprender" },
};
const TIPO: Record<string, { label: string; tone?: DecisionTag["tone"] }> = {
  startup: { label: "Startup", tone: "accent" },
  publico: { label: "El Estado" },
  grande: { label: "Empresa grande" },
  pyme: { label: "Pyme" },
  extranjero: { label: "Remoto en dólares", tone: "accent" },
};

function linea(x: Suceso): { tono: "bueno" | "malo" | "neutro"; texto: string } | null {
  if (x.silencioso || x.id === "tipo_de_empleador") return null;
  if (x.id === "recesion") return { tono: "malo", texto: "El país entró en recesión." };
  if (x.oferta) return { tono: "bueno", texto: `Fichaste por ${x.oferta.empresa}${x.oferta.cargo ? `: ${x.oferta.cargo}` : ""}.` };
  if (x.opcion === "quedarse") return { tono: "neutro", texto: x.texto };
  if (x.origen === "gemelo") return { tono: x.tono, texto: `Tu gemelo decidió por ti: ${x.texto.charAt(0).toLowerCase()}${x.texto.slice(1)}` };
  const nombre = x.empleador?.nombre && x.tono !== "malo" ? ` (${x.empleador.nombre})` : "";
  return { tono: x.tono, texto: x.texto.replace(/\.$/, `${nombre}.`) };
}

function Club({ nombre, cargo, sueldo }: { nombre: string; cargo: string; sueldo: number }) {
  return (
    <div className="vd-club">
      <div className="vd-club-quien">
        <Meta>Tu pega</Meta>
        <span className="vd-club-nombre">{nombre}</span>
        {cargo && <span className="vd-club-cargo">{cargo}</span>}
      </div>
      <div className="vd-club-sueldo">
        <b>{sueldo > 0 ? clpCorto(sueldo) : "—"}</b>
        <span>al mes</span>
      </div>
    </div>
  );
}

export function Stats({ c, previo }: { c: Contadores; previo?: Contadores }) {
  const celdas: [string, string, boolean][] = [
    ["Empresas", String(c.empresas), !!previo && c.empresas > previo.empresas],
    ["Ascensos", String(c.ascensos), !!previo && c.ascensos > previo.ascensos],
    ["Sueldo máx", clpCorto(c.sueldoMax), !!previo && c.sueldoMax > previo.sueldoMax],
    ["Ahorro", clpCorto(c.ahorro), !!previo && c.ahorro > previo.ahorro * 1.15],
  ];
  return (
    <div className="vd-stats">
      {celdas.map(([n, v, sube]) => (
        <div key={n} className={`vd-stat${sube ? " vd-stat--sube" : ""}`}>
          <b>{v}</b>
          <span>{n}</span>
        </div>
      ))}
    </div>
  );
}

type Props = {
  turno: Turno;
  club: { nombre: string; cargo: string };
  contadores: Contadores;
  previos?: Contadores;
  narrado: AnioNarrado | undefined;
  caso: Caso | undefined;
  identidad: Identidad;
  base: Record<string, Record<string, number>>;
  cargando: boolean;
  onElegir: (id: string) => void;
};

/** Una temporada: cómo te fue el año pasado y el mercado de este año. Un toque y se juega. */
export function Temporada({ turno, club, contadores, previos, narrado, caso, identidad, base, cargando, onElegir }: Props) {
  const p = turno.pendiente!;
  const anterior = turno.anios[turno.anios.length - 1];
  const quedarse = p.opciones.find((o) => o.id === "quedarse")?.id ?? null;
  const [sel, setSel] = useState<string | null>(quedarse);
  const de = (id: string) => caso?.opciones.find((o) => o.id === id);
  const ofertas = p.opciones.filter((o) => o.oferta);
  const recap = anterior ? anterior.eventos.map(linea).filter((x): x is NonNullable<typeof x> => x !== null) : [];
  const cambioSueldo = anterior && anterior.sueldo_inicio > 0 && anterior.sueldo > 0 ? anterior.sueldo / anterior.sueldo_inicio - 1 : null;
  const esMercado = p.decision.id === "mercado";

  const titulo = (o: Opcion) => {
    if (o.oferta) return o.oferta.empresa;
    if (o.id === "quedarse") return o.nombre;
    const [, dec, op] = o.id.split(":");
    return de(o.id)?.titulo ?? CARTA[dec ?? p.decision.id]?.[op ?? o.id] ?? o.nombre;
  };
  const subtitulo = (o: Opcion) => {
    if (o.oferta) {
      const cambio = o.oferta.cambio !== null ? ` (${o.oferta.cambio >= 0 ? "+" : "−"}${Math.abs(Math.round(o.oferta.cambio * 100))}%)` : "";
      return `${o.oferta.cargo} · ${clpCorto(o.oferta.sueldo)}${cambio}`;
    }
    if (o.id === "quedarse") return "Sin cambios este año.";
    return de(o.id)?.texto ?? (o.detalle || undefined);
  };
  const tags = (o: Opcion): DecisionTag[] => {
    const t = etiquetas(o, o.decision ?? p.decision.id, identidad, base).filter((x) => !(o.oferta && x.label === "+ Dinero"));
    return o.oferta && TIPO[o.oferta.tipo] ? [{ label: TIPO[o.oferta.tipo].label, tone: TIPO[o.oferta.tipo].tone }, ...t].slice(0, 4) : t;
  };

  return (
    <Screen gap={16} tone={anterior?.tono ?? "dia"} key={`${p.anio}-${turno.anios.length}`}>
      <ScreenHeader
        left={
          <Pill>
            {anioDe(p.anio)} · {p.edad} años
          </Pill>
        }
        right={
          <Meta>
            Temporada {p.anio + 1} de {turno.horizonte_anios}
          </Meta>
        }
      />
      <Club nombre={club.nombre} cargo={club.cargo} sueldo={turno.estado.sueldo} />
      <Stats c={contadores} previo={previos} />

      {anterior && (
        <Stack as="section" gap={10}>
          <Heading level={3} as="h2">
            {narrado?.titulo ?? `Así fue tu ${anioDe(anterior.t)}`}
          </Heading>
          {narrado?.relato && <Text size="sm">{narrado.relato}</Text>}
          <div className="vd-recap">
            {recap.map((l, i) => (
              <div className="vd-recap-linea" key={i}>
                <i className={l.tono}>{l.tono === "bueno" ? "▲" : l.tono === "malo" ? "▼" : "•"}</i>
                <span>{l.texto}</span>
              </div>
            ))}
            {cambioSueldo !== null && Math.abs(cambioSueldo) >= 0.01 && (
              <div className="vd-recap-linea">
                <i className={cambioSueldo > 0 ? "bueno" : "malo"}>{cambioSueldo > 0 ? "▲" : "▼"}</i>
                <span>
                  Sueldo {clpCorto(anterior.sueldo_inicio)} → {clpCorto(anterior.sueldo)} ({cambioSueldo > 0 ? "+" : "−"}
                  {Math.abs(Math.round(cambioSueldo * 100))}%)
                </span>
              </div>
            )}
            {recap.length === 0 && cambioSueldo === null && (
              <div className="vd-recap-linea">
                <i className="neutro">•</i>
                <span>Un año tranquilo.</span>
              </div>
            )}
          </div>
          <IndicatorGrid label="Cómo cambió tu vida" values={aKit(anterior.indicadores)} previous={aKit(anterior.indicadores_inicio)} />
        </Stack>
      )}

      <Stack gap={6} style={{ marginTop: 4 }}>
        <Heading level={2} as="h1">
          {caso?.titulo ??
            (esMercado
              ? ofertas.length
                ? `${ofertas.length === 1 ? "Una oferta" : `${ofertas.length} ofertas`} en la mesa.`
                : "Nadie te llamó esta temporada."
              : p.decision.pregunta)}
        </Heading>
        <Meta>{esMercado ? `Mercado ${anioDe(p.anio)}` : "No la puedes esquivar"}</Meta>
      </Stack>
      <DecisionList<string>
        label="Qué haces esta temporada"
        value={sel}
        onChange={setSel}
        options={p.opciones.map((o) => ({ id: o.id, art: <DecisionArt kind={arte(o.arte)} />, title: titulo(o), subtitle: subtitulo(o), tags: tags(o) }))}
      />
      {ofertas.length > 0 && (
        <span className="vd-fuente">Empresas reales: SII (nómina 2024), Get on Board, Y Combinator y empleospublicos.cl. El sueldo y lo que pasa después los calcula el simulador.</span>
      )}
      <ScreenFooter>
        <Button disabled={!sel || cargando} onClick={() => sel && onElegir(sel)}>
          {cargando ? "Jugando…" : `Jugar temporada ${anioDe(p.anio)}`}
        </Button>
      </ScreenFooter>
    </Screen>
  );
}
