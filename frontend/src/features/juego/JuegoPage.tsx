import "./juego.css";
import { useEffect } from "react";
import { Button, Heading, Screen, ScreenFooter, Stack, Text } from "@/shared/ui";
import { Carta } from "./components/Carta";
import { CierrePantalla } from "./components/Cierre";
import { DudaPicker } from "./components/DudaPicker";
import { Inicio } from "./components/Inicio";
import { PerfilForm } from "./components/PerfilForm";
import { QuePaso } from "./components/QuePaso";
import { useCatalogo } from "./hooks/useCatalogo";
import { usePartida } from "./hooks/usePartida";

/** El juego completo: perfil → duda → carta → qué te pasó → … → cierre. */
export function JuegoPage() {
  return (
    <div className="jg-fondo">
      <Juego />
    </div>
  );
}

function Juego() {
  const j = usePartida();
  const { catalogo, error: errorCatalogo } = useCatalogo();

  // cada pantalla nueva (otra fase, otra carta) parte desde arriba
  const punto = `${j.fase}:${j.vista?.historia.length ?? 0}:${j.vista?.anio_en_curso?.decisiones.length ?? 0}:${j.vista?.pendiente?.decision ?? ""}`;
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [punto]);

  if (j.fase === "perfil") {
    return <PerfilForm inicial={j.perfil} catalogo={catalogo} errorCatalogo={errorCatalogo} onVolver={j.irAInicio} onListo={j.verDudas} />;
  }
  if (j.fase === "duda") {
    return (
      <DudaPicker dudas={j.dudas} sugerida={j.dudaSugerida} cargando={j.cargando} error={j.error} onVolver={j.irAPerfil} onElegir={j.empezar} />
    );
  }
  if (j.fase === "carta" && j.vista?.pendiente) {
    return (
      <Carta
        vista={j.vista}
        riesgo={j.perfil.riesgo}
        cargando={j.cargando}
        recalculando={j.recalculando}
        error={j.error}
        onElegir={j.elegir}
        onComparar={j.compararCon}
      />
    );
  }
  if (j.fase === "paso" && j.vista) return <QuePaso previa={j.previa} vista={j.vista} onSeguir={j.seguir} />;
  if (j.fase === "cierre" && j.vista?.cierre) return <CierrePantalla vista={j.vista} onOtraVida={j.jugarDeNuevo} onCambiarPerfil={j.irAPerfil} />;
  if (j.fase !== "inicio") {
    // no debería pasar: una fase sin los datos que necesita
    return (
      <Screen>
        <Stack>
          <Heading level={2}>Se nos perdió el hilo.</Heading>
          <Text>No pudimos mostrar este punto de la partida.</Text>
        </Stack>
        <ScreenFooter>
          <Button onClick={j.irAInicio}>Volver al inicio</Button>
        </ScreenFooter>
      </Screen>
    );
  }
  return (
    <Inicio
      hayPartida={j.partida !== null}
      cargando={j.cargando}
      error={j.error}
      onContinuar={j.continuar}
      onEmpezar={() => {
        j.descartar();
        j.irAPerfil();
      }}
    />
  );
}
