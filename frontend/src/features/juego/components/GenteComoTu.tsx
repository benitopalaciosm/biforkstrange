import { useEffect, useState } from "react";
import { Heading, Meta, Stack, Text } from "@/shared/ui";
import { getGenteComoTu } from "../api";
import { plata } from "../textos";
import type { DatoReal, OpcionComparada, Perfil } from "../types";
import "../demo.css";

/** El número que dieron tus gemelos para ese mismo tema, cuando hay uno comparable. */
function deTusGemelos(d: DatoReal, elegida: OpcionComparada | undefined, sueldoInicial: number, anios: number): string | null {
  if (d.clave === "sueldo") {
    const edad = elegida?.trayectoria[elegida.trayectoria.length - 1]?.edad;
    const hoy = `Tú al empezar: ${plata(sueldoInicial)}`;
    return elegida && edad ? `${hoy} · tus gemelos con «${elegida.nombre}», a los ${edad} años: ${plata(elegida.sueldo.p50)} típico` : hoy;
  }
  if (d.clave === "cesantia" && elegida) {
    return `Tus gemelos con «${elegida.nombre}» quedaron sin pega alguna vez en ${Math.round(elegida.paso_por_cesantia * 100)} de 100 mundos en ${anios} años.`;
  }
  return null;
}

/**
 * "Gente como tú, de verdad": datos de encuestas (ESI, EPS) de chilenos con tu edad, estudios y rubro,
 * cada uno con su fuente, al lado del número que dieron tus gemelos. Si la API falla, no se muestra.
 */
export function GenteComoTu({
  perfil, elegida, sueldoInicial, anios,
}: {
  perfil: Perfil;
  /** La opción que tomaste en tu primera decisión: de ahí salen los números de tus gemelos. */
  elegida?: OpcionComparada;
  sueldoInicial: number;
  anios: number;
}) {
  const [datos, setDatos] = useState<DatoReal[] | null>(null);
  const clave = JSON.stringify([perfil.edad, perfil.sexo, perfil.edu, perfil.rubro, perfil.estado]);

  useEffect(() => {
    let vigente = true;
    getGenteComoTu(perfil)
      .then((r) => vigente && setDatos(r.datos))
      .catch(() => vigente && setDatos([]));
    return () => {
      vigente = false;
    };
    // se vuelve a pedir solo si cambian los campos que filtran
  }, [clave]);

  if (!datos || datos.length === 0) return null;
  return (
    <Stack as="section" gap={10}>
      <Stack gap={4}>
        <Meta>Gente como tú, de verdad</Meta>
        <Heading level={3} as="h2">
          Lo que dicen las encuestas de chilenos parecidos a ti
        </Heading>
        <Text size="sm">No es la simulación: son personas reales con tu edad, tus estudios o tu rubro.</Text>
      </Stack>
      <div className="jg-gente">
        {datos.map((d) => {
          const gemelos = deTusGemelos(d, elegida, sueldoInicial, anios);
          return (
            <div className="jg-gente-dato" key={d.clave}>
              <span className="jg-chico">{d.titulo}</span>
              <Text>
                <strong>{d.frase}</strong>
              </Text>
              {gemelos && <span className="jg-gente-gemelos">{gemelos}</span>}
              <span className="jg-gente-fuente">
                Fuente:{" "}
                {d.fuente_url ? (
                  <a href={d.fuente_url} target="_blank" rel="noreferrer">
                    {d.fuente}
                  </a>
                ) : (
                  d.fuente
                )}{" "}
                · {d.n.toLocaleString("es-CL")} casos
              </span>
            </div>
          );
        })}
      </div>
    </Stack>
  );
}
