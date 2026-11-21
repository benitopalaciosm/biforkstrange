import { useEffect, useState } from "react";
import { simulationApi } from "../api";
import type { PerfilOcupacion } from "../types";

/** Perfil del último trabajo según las tablas. Se vuelve a pedir al cambiar edad u ocupación. */
export function usePerfilOcupacion(grupo: number, edad: number | null) {
  const [perfil, setPerfil] = useState<PerfilOcupacion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (edad === null) return;
    let vigente = true;
    setLoading(true);
    // pequeña espera para no pedir en cada tecla mientras se escribe la edad
    const espera = setTimeout(() => {
      simulationApi
        .perfil(grupo, edad)
        .then((p) => {
          if (!vigente) return;
          setPerfil(p);
          setError("");
        })
        .catch((e) => vigente && setError(String(e)))
        .finally(() => vigente && setLoading(false));
    }, 250);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [grupo, edad]);

  return { perfil, loading, error };
}
