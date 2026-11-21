"""Muchas vidas del mismo gemelo: la política de los gemelos y las dos formas de recorrer una vida.

- `vida_automatica`: la política responde todas las preguntas (los gemelos que juegan solos).
- `reproducir`: la partida del jugador. Responde con su lista de elecciones (una por
  temporada; el resto lo decide la política) y se detiene en la primera pregunta sin respuesta.
  Como el motor es determinista, una partida se guarda como `(gemelo, mundo, semilla, elecciones)`
  y se recalcula entera en cada turno.
"""

from __future__ import annotations

import math

import numpy as np

from app.sim.catalogo import Catalogo
from app.sim.motor import Pregunta, Vida, _flujo


def elegir(cat: Catalogo, vida: Vida, pregunta: Pregunta) -> str:
    """Política de los gemelos: base de cada opción inclinada por la tolerancia al riesgo."""
    tabla = cat.juego["politica"]["opciones"].get(pregunta.decision.id, {})
    propia = (vida.politica or {}).get(pregunta.decision.id)
    mezcla = cat.juego["politica"]["peso_gemelo"]
    inclinacion = (vida.e["riesgo"] - 50) / 50
    pesos = []
    for alt in pregunta.alternativas:
        base, riesgo = tabla.get(alt.opcion.id, (1.0, 0.0))
        if propia and alt.opcion.id in propia:
            # El gemelo decide en parte como la gente (base calibrada) y en parte como su dueño.
            base = (1 - mezcla) * base + mezcla * propia[alt.opcion.id]
        hermanas = sum(1 for a in pregunta.alternativas if a.opcion.id == alt.opcion.id)
        pesos.append(base / hermanas * math.exp(riesgo * inclinacion))
    r = _flujo(vida.semilla, vida.indice, pregunta.anio, f"pol:{pregunta.decision.id}")
    u = r.random() * sum(pesos)
    for alt, w in zip(pregunta.alternativas, pesos):
        u -= w
        if u < 0:
            return alt.id
    return pregunta.alternativas[-1].id


def vida_automatica(cat: Catalogo, estado: dict, prioridades: dict, semilla: int, indice: int, anios: int,
                    detalle: bool = False, politica: dict | None = None) -> Vida:
    vida = Vida(cat, estado, prioridades, semilla, indice, detalle, politica)
    gen = vida.correr(anios)
    try:
        pregunta = next(gen)
        while True:
            pregunta = gen.send(elegir(cat, vida, pregunta))
    except StopIteration:
        return vida


def reproducir(cat: Catalogo, estado: dict, prioridades: dict, semilla: int, anios: int, elecciones: list[str],
               indice: int = 0, empleador: dict | None = None, politica: dict | None = None, cargo: str = "") -> tuple[Vida, Pregunta | None]:
    """Recorre la partida con las elecciones dadas. Devuelve la pregunta pendiente, o None si terminó."""
    vida = Vida(cat, estado, prioridades, semilla, indice, detalle=True, empleador=empleador, politica=politica,
                auto=lambda v, q: elegir(cat, v, q), cargo=cargo)
    gen = vida.correr(anios)
    pendientes = list(elecciones)
    try:
        pregunta = next(gen)
        while True:
            if not pendientes:
                return vida, pregunta
            pregunta = gen.send(pendientes.pop(0))
    except StopIteration:
        if pendientes:
            raise ValueError(f"sobran {len(pendientes)} elecciones: la partida ya terminó") from None
        return vida, None


def percentil_en(orden: np.ndarray, valor: float) -> float:
    """En qué percentil cae `valor` dentro de una distribución ya ordenada."""
    return float(np.searchsorted(orden, valor, side="right")) / len(orden) * 100
