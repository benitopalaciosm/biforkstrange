import { useEffect, useState } from "react";
import { Inicio } from "@/features/juego/Inicio";
import { Jugando } from "@/features/juego/Jugando";
import { SobreTi, type Datos } from "@/features/juego/SobreTi";
import { UiKitPage } from "@/features/ui-kit";
import { api } from "@/shared/api";
import type { Catalogo } from "@/shared/types";
import { Screen, Text } from "@/shared/ui";

type Paso = { paso: "inicio" } | { paso: "sobre" } | { paso: "jugando"; semilla: number; diaria: boolean };

const nuevaSemilla = () => Math.floor(Math.random() * 1_000_000_000);
const semillaDelDia = () => Number(new Date().toISOString().slice(0, 10).replace(/-/g, ""));

export default function App() {
  if (window.location.pathname.startsWith("/ui")) return <UiKitPage />;
  return <Juego />;
}

function Juego() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [error, setError] = useState("");
  const [paso, setPaso] = useState<Paso>({ paso: "inicio" });
  const [datos, setDatos] = useState<Datos | null>(null);

  useEffect(() => {
    api.catalogo().then(setCatalogo).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [paso]);

  if (error)
    return (
      <Screen>
        <Text>No se pudo conectar con el simulador: {error}</Text>
      </Screen>
    );
  if (!catalogo)
    return (
      <Screen>
        <span className="vd-espera">Cargando…</span>
      </Screen>
    );

  async function listo(d: Datos) {
    await api.gemelo(d.perfil, d.prioridades); // valida el perfil antes de jugar
    setDatos(d);
    setPaso({ paso: "jugando", semilla: nuevaSemilla(), diaria: false });
  }

  return (
    <>
      {paso.paso === "inicio" && <Inicio onEmpezar={() => setPaso({ paso: datos ? "sobre" : "sobre" })} />}
      {paso.paso === "sobre" && <SobreTi catalogo={catalogo} inicial={datos} onVolver={() => setPaso({ paso: "inicio" })} onListo={listo} />}
      {paso.paso === "jugando" && datos && (
        <Jugando
          key={`${paso.semilla}-${paso.diaria}`}
          perfil={datos.perfil}
          prioridades={datos.prioridades}
          identidad={datos.identidad}
          mundo={datos.mundo}
          mundoNombre={catalogo.mundos.find((m) => m.id === datos.mundo)?.nombre ?? datos.mundo}
          semilla={paso.semilla}
          diaria={paso.diaria}
          base={catalogo.politica_base}
          conClaude={catalogo.claude}
          onOtraVida={(diaria) => setPaso({ paso: "jugando", semilla: diaria ? semillaDelDia() : nuevaSemilla(), diaria })}
          onInicio={() => setPaso({ paso: "inicio" })}
        />
      )}
    </>
  );
}
