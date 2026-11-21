import { Heading, Meta, Panel, Stack, Text } from "@/shared/ui";
import { usePerfilOcupacion } from "../hooks/usePerfilOcupacion";
import type { PerfilOcupacion } from "../types";
import { BarList } from "./BarList";

/** "3 meses", "1 año", "2 años y medio": duraciones en palabras. */
function duracion(anios: number) {
  if (anios < 1) {
    const meses = Math.max(1, Math.round(anios * 12));
    return meses === 1 ? "1 mes" : `${meses} meses`;
  }
  const medios = Math.round(anios * 2) / 2;
  const entero = Math.floor(medios);
  const base = entero === 1 ? "1 año" : `${entero} años`;
  return medios % 1 ? `${base} y medio` : base;
}

const de100 = (p: number) => Math.round(p * 100);

function Contenido({ perfil }: { perfil: PerfilOcupacion }) {
  const t = perfil.termino_anual;
  const d = perfil.duracion_anios;
  return (
    <>
      <Stack gap={6}>
        <Meta>¿Termina este año?</Meta>
        <Text>
          De cada 100 personas de {perfil.edad} años con un trabajo de este tipo, a unas <strong>{de100(t.total)}</strong> se
          les termina dentro del año.
        </Text>
        <BarList
          color="var(--bienestar)"
          items={[
            { key: "directo", label: "Pasa directo a otro empleo", prob: t.cambio_directo },
            { key: "cesantia", label: "Queda cesante y busca trabajo", prob: t.cesantia },
            { key: "inactividad", label: "Deja de buscar trabajo", prob: t.inactividad },
          ]}
        />
      </Stack>

      <Stack gap={6}>
        <Meta>¿Cuánto suele durar?</Meta>
        <Text>
          La mitad de estos trabajos dura <strong>{duracion(d.p50)} o menos</strong>.
        </Text>
        <Text size="sm">
          Uno de cada cuatro dura {duracion(d.p25)} o menos, y uno de cada cuatro dura más de {duracion(d.p75)}.
        </Text>
      </Stack>

      <Stack gap={6}>
        <Meta>¿A qué tipo de trabajo pasas después?</Meta>
        <Text size="sm">
          De cada 100 personas que cambian de empleo desde este tipo de trabajo, unas {de100(perfil.p_cambia_grupo)} pasan a
          un tipo distinto.
        </Text>
        <BarList
          items={perfil.siguiente.map((s) => ({
            key: s.grupo,
            label: s.nombre,
            prob: s.prob,
            mark: s.grupo === perfil.grupo ? "el mismo tipo" : undefined,
          }))}
        />
      </Stack>
    </>
  );
}

export function PerfilPanel({ grupo, edad }: { grupo: number; edad: number | null }) {
  const { perfil, loading, error } = usePerfilOcupacion(grupo, edad);
  return (
    <Panel style={{ gap: 20 }} aria-busy={loading}>
      <Stack gap={4}>
        <Heading level={3} as="h2">
          Qué dicen los datos sobre tu último trabajo
        </Heading>
        {perfil && <Text size="sm">{perfil.nombre}</Text>}
      </Stack>
      {error && (
        <Text size="sm" style={{ color: "var(--vida)" }}>
          No se pudo cargar: {error}
        </Text>
      )}
      {edad === null && <Text size="sm">Escribe una edad válida para ver los datos.</Text>}
      {!perfil && !error && edad !== null && <Text size="sm">Cargando…</Text>}
      {perfil && edad !== null && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20, opacity: loading ? 0.5 : 1 }}>
          <Contenido perfil={perfil} />
        </div>
      )}
      <Text size="sm">Término y cesantía: EPS 2024, Chile. Duración y destino: CVs de Flandes (JobHop).</Text>
    </Panel>
  );
}
