import { useEffect, useMemo, useState } from "react";
import type { Identidad, Perfil, Prioridades } from "@/shared/types";
import { Button, Heading, Screen, Stack, Text } from "@/shared/ui";
import { contadores } from "./carrera";
import { Fin } from "./Fin";
import { Momento } from "./Momento";
import { Temporada } from "./Temporada";
import { useVida } from "./useVida";

type Props = {
  perfil: Perfil;
  prioridades: Prioridades;
  identidad: Identidad;
  mundo: string;
  mundoNombre: string;
  semilla: number;
  diaria: boolean;
  base: Record<string, Record<string, number>>;
  conClaude: boolean;
  onOtraVida: (diaria: boolean) => void;
  onInicio: () => void;
};

const TIPO: Record<string, string> = { grande: "Empresa grande", pyme: "Pyme", startup: "Startup", publico: "El Estado", extranjero: "Remoto" };

/** Una carrera de principio a fin: temporadas, golpes duros y la carta final. */
export function Jugando(p: Props) {
  const vida = useVida({ perfil: p.perfil, prioridades: p.prioridades, identidad: p.identidad, mundo: p.mundo, mundoNombre: p.mundoNombre, semilla: p.semilla, conClaude: p.conClaude });
  const [momentoVisto, setMomentoVisto] = useState<Set<number>>(new Set());
  const t = vida.turno;
  const empresa0 = p.identidad.empresa || (p.perfil.estado === "empleado" ? TIPO[p.perfil.tipo_empleador ?? "pyme"] : "Sin pega");
  const c = useMemo(() => contadores(t?.anios ?? [], p.perfil, empresa0, p.perfil.ahorro), [t, p.perfil, empresa0]);
  const previos = useMemo(() => contadores((t?.anios ?? []).slice(0, -1), p.perfil, empresa0, p.perfil.ahorro), [t, p.perfil, empresa0]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [t?.anios.length, t?.terminada]);

  if (vida.error)
    return (
      <Screen>
        <Stack gap={10}>
          <Heading level={2}>Algo falló.</Heading>
          <Text>{vida.error}</Text>
        </Stack>
        <Button onClick={vida.reintentar}>Reintentar</Button>
      </Screen>
    );
  if (!t)
    return (
      <Screen>
        <span className="vd-espera">Tu gemelo se pone la camiseta…</span>
      </Screen>
    );

  // Un golpe duro en el año que acaba de cerrar: se cuenta antes de seguir.
  const ultimo = t.anios[t.anios.length - 1];
  if (ultimo?.momento && !momentoVisto.has(ultimo.t)) {
    return (
      <Momento
        anio={ultimo}
        narrado={vida.narrados[ultimo.t]}
        onSeguir={() => setMomentoVisto((s) => new Set(s).add(ultimo.t))}
        onOtraVez={() => p.onOtraVida(false)}
      />
    );
  }

  if (t.terminada)
    return (
      <Fin
        turno={t}
        perfil={p.perfil}
        prioridades={p.prioridades}
        identidad={p.identidad}
        mundo={p.mundo}
        semilla={p.semilla}
        diaria={p.diaria}
        contadores={c}
        historia={vida.historia()}
        conClaude={p.conClaude}
        onOtraVida={p.onOtraVida}
        onInicio={p.onInicio}
      />
    );

  const club = t.empleador?.nombre
    ? { nombre: t.empleador.nombre, cargo: t.empleador.cargo ?? p.identidad.cargo }
    : t.estado.estado === "empleado"
      ? { nombre: c.clubes[c.clubes.length - 1]?.nombre ?? empresa0, cargo: p.identidad.cargo }
      : { nombre: t.estado.estado === "fundador" ? "Tu empresa" : "Sin pega", cargo: "" };

  return (
    <Temporada
      key={`${t.pendiente?.anio}-${vida.elecciones.length}`}
      turno={t}
      club={club}
      contadores={c}
      previos={t.anios.length ? previos : undefined}
      narrado={ultimo ? vida.narrados[ultimo.t] : undefined}
      caso={vida.caso}
      identidad={p.identidad}
      base={p.base}
      cargando={vida.cargando}
      onElegir={vida.elegir}
    />
  );
}
