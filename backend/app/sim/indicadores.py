"""Las cuatro barras del juego (0 a 100) y la felicidad.

Los pesos están en `data/juego.json` → `indicadores`. Dinero y Carrera se apoyan en la ESI;
Bienestar y Vida personal son reglas simples del equipo y el juego lo dice.

La felicidad no es una barra: es qué tan cerca queda la vida de las prioridades que la
persona repartió. Por eso dos personas con la misma partida terminan con felicidad distinta.
"""

from __future__ import annotations

from app.sim.catalogo import Catalogo

NOMBRES = ("dinero", "carrera", "bienestar", "vida_personal")
_OCUPADO = ("empleado", "fundador", "independiente")


def _tramo_enut(horas: float) -> str:
    return "<30" if horas < 30 else "30-44" if horas < 45 else "45-54" if horas < 55 else "55+"


def _tiempo_libre(cat: Catalogo, horas: float) -> float:
    """Ocio diario según horas de trabajo (ENUT 2023), relativo a quien trabaja menos de 30."""
    pq = cat.paquete
    ocio = pq.tabla("enut_tiempo_por_horas", "ocio_h_dia", "tramo_horas", _tramo_enut(horas))
    return ocio / pq.tabla("enut_tiempo_por_horas", "ocio_h_dia", "tramo_horas", "<30")


def indicadores(cat: Catalogo, e: dict) -> dict[str, float]:
    cfg = cat.juego["indicadores"]
    ocupado = e["estado"] in _OCUPADO

    d = cfg["dinero"]
    percentil = e["percentil"] if e["sueldo"] > 0 else 0
    # Colchón: meses de gasto cubiertos por el ahorro, con rendimiento decreciente (raíz).
    meses = max(0.0, e["ahorro"]) / max(e["gasto_mensual"], 1)
    colchon = min(1.0, (meses / d["meses_colchon_lleno"]) ** 0.5)
    dinero = d["peso_percentil_ingreso"] * percentil + d["peso_colchon"] * 100 * colchon

    c = cfg["carrera"]
    carrera = 100 * (c["peso_nivel"] * e["nivel"] / 4 + c["peso_skill"] * e["skill"] / 100 + c["peso_red"] * e["red"] / 100 + c["peso_ocupado"] * (1 if ocupado else 0))

    b = cfg["bienestar"]
    bienestar = b["peso_animo"] * e["animo"] + b["peso_energia"] * e["energia"]

    v = cfg["vida_personal"]
    horas = e["horas"] if ocupado else 0
    tiempo = min(1.0, _tiempo_libre(cat, horas) * e["tiempo_con_tu_gente"])
    relaciones = 1.0 if e["pareja"] != "no" else v["sin_pareja"]
    vida = 100 * (v["peso_tiempo"] * tiempo + v["peso_relaciones"] * relaciones)

    acota = lambda x: round(max(0.0, min(100.0, x)), 1)  # noqa: E731
    return {"dinero": acota(dinero), "carrera": acota(carrera), "bienestar": acota(bienestar), "vida_personal": acota(vida)}


def felicidad(ind: dict[str, float], prioridades: dict[str, float]) -> float:
    total = sum(prioridades.get(k, 0) for k in NOMBRES) or 1
    return sum(prioridades.get(k, 0) * ind[k] for k in NOMBRES) / total
