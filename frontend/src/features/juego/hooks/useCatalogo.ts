import { useEffect, useState } from "react";
import { getCatalogo } from "../api";
import type { Catalogo } from "../types";

export function useCatalogo() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    getCatalogo()
      .then((c) => vivo && setCatalogo(c))
      .catch((e: unknown) => vivo && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      vivo = false;
    };
  }, []);

  return { catalogo, error };
}
