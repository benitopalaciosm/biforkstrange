import { http, post } from "@/shared/lib/http";
import type { Anio, Calibracion, Catalogo, Epilogo, GemeloLeido, Historia, Identidad, Indicadores, Perfil, Prioridades, ResumenPartida, Suerte, Turno } from "@/shared/types";

type Base = { perfil: Perfil; prioridades: Prioridades; identidad: Identidad };

export const api = {
  catalogo: () => http<Catalogo>("/api/catalogo"),
  gemelo: (perfil: Perfil, prioridades: Prioridades) => post<{ edad: number; indicadores: Indicadores }>("/api/gemelo", { perfil, prioridades }),
  leerGemelo: (archivo: File | null, sobre_ti: string) => {
    const body = new FormData();
    if (archivo) body.append("archivo", archivo);
    body.append("sobre_ti", sobre_ti);
    return http<GemeloLeido>("/api/gemelo/leer", { method: "POST", body });
  },
  turno: (p: Base & { mundo: string; semilla: number; elecciones: string[] }) => post<Turno>("/api/partidas/turno", p),
  suerte: (p: Base & { mundo: string; semilla: number; felicidad: number; sueldo_final: number; ingreso_acumulado: number }) => post<Suerte>("/api/suerte", p),
  historia: (p: { perfil: Perfil; identidad: Identidad; mundo: string; historia_previa: string[]; anio: Anio | null; pendiente: Turno["pendiente"] }) =>
    post<Historia>("/api/historia", p),
  epilogo: (p: { perfil: Perfil; identidad: Identidad; camino: string; mundo: string; historia: string[]; resumen: ResumenPartida; anio_final: number }) =>
    post<{ epilogo: Epilogo | null }>("/api/epilogo", p),
  calibracion: () => http<Calibracion>("/api/calibracion"),
};
