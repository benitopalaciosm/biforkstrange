"""Muchas vidas del mismo gemelo: política de los gemelos, partidas jugadas y comparación.

Dos formas de recorrer una vida:
- `vida_automatica`: la política responde todas las preguntas (los gemelos que juegan solos).
- `reproducir`: responde con la lista de elecciones del jugador y se detiene en la primera
  pregunta sin respuesta. Como el motor es determinista, una partida se guarda como
  `(gemelo, mundo, semilla, elecciones)` y se recalcula entera en cada turno.
"""

from __future__ import annotations

import math
from random import Random

import numpy as np

from app.sim.catalogo import Catalogo
from app.sim.indicadores import NOMBRES
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
                    bifurcacion: tuple[str, str] | None = None, detalle: bool = False, politica: dict | None = None) -> Vida:
    vida = Vida(cat, estado, prioridades, semilla, indice, detalle, politica)
    gen = vida.correr(anios, bifurcacion[0] if bifurcacion else None)
    try:
        pregunta = next(gen)
        while True:
            if pregunta.origen == "bifurcacion":
                respuesta = bifurcacion[1]  # type: ignore[index]
            else:
                respuesta = elegir(cat, vida, pregunta)
            pregunta = gen.send(respuesta)
    except StopIteration:
        return vida


def reproducir(cat: Catalogo, estado: dict, prioridades: dict, semilla: int, anios: int, elecciones: list[str],
               bifurcacion: str | None = None, indice: int = 0, empleador: dict | None = None, politica: dict | None = None,
               cargo: str = "") -> tuple[Vida, Pregunta | None]:
    """Recorre la partida con las elecciones dadas. Devuelve la pregunta pendiente, o None si terminó."""
    vida = Vida(cat, estado, prioridades, semilla, indice, detalle=True, empleador=empleador, politica=politica,
                auto=lambda v, q: elegir(cat, v, q), cargo=cargo)
    gen = vida.correr(anios, bifurcacion)
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


# ---------------------------------------------------------------------- comparación
_HECHOS = {
    "recesion_temprana": "hay una recesión en los primeros 3 años",
    "separacion_empleo/cesante": "te despiden y quedas cesante",
    "startup_cierra/cierra": "la startup cierra",
    "venta_startup": "compran la startup",
    "ascenso/sube": "te ascienden",
    "seguir_con_tu_empresa/cierra": "tu empresa cierra",
    "ano_cesante": "pasas al menos un año sin pega",
}


def _resumen_vidas(vidas: list[Vida]) -> dict:
    n = len(vidas)
    fel = np.array([v.felicidad() for v in vidas])
    ingreso = np.array([sum(12 * a["sueldo"] for a in v.anios) for v in vidas])
    sueldos = np.array([[a["sueldo"] for a in v.anios] for v in vidas])
    sin_ingreso = np.array([sum(1 for a in v.anios if a["sueldo"] <= 0) for v in vidas])
    ind = {k: np.array([[a["indicadores"][k] for a in v.anios] for v in vidas]).mean(axis=1) for k in NOMBRES}
    pct = lambda x, q: float(np.percentile(x, q))  # noqa: E731
    return {
        "n": n,
        "felicidad": {"p10": pct(fel, 10), "p50": pct(fel, 50), "p90": pct(fel, 90), "media": float(fel.mean())},
        "ingreso_acumulado": {"p10": pct(ingreso, 10), "p50": pct(ingreso, 50), "p90": pct(ingreso, 90)},
        "sueldo_final": {"p10": pct(sueldos[:, -1], 10), "p50": pct(sueldos[:, -1], 50), "p90": pct(sueldos[:, -1], 90)},
        "sueldo_por_anio": [
            {"t": t, "p10": pct(sueldos[:, t], 10), "p50": pct(sueldos[:, t], 50), "p90": pct(sueldos[:, t], 90)}
            for t in range(sueldos.shape[1])
        ],
        "indicadores": {k: float(np.median(v)) for k, v in ind.items()},
        "indicadores_rango": {k: {"p10": pct(v, 10), "p50": pct(v, 50), "p90": pct(v, 90)} for k, v in ind.items()},
        "prob_sin_pega": float((sin_ingreso > 0).mean()),
        "anios_sin_ingreso": float(sin_ingreso.mean()),
        "_felicidad": fel,
        "_ingreso": ingreso,
        "_indicadores": ind,
    }


def _margen(p: float, n: int) -> float:
    return 1.96 * math.sqrt(max(p * (1 - p), 1e-9) / n)


UMBRAL_PUNTOS = 1.0  # una diferencia menor que un punto (de 100) cuenta como empate
UMBRAL_INGRESO = 0.02  # idem para el ingreso acumulado: menos de 2%


def _gana_vector(a: np.ndarray, b: np.ndarray, umbral: float = UMBRAL_PUNTOS, relativo: bool = False) -> np.ndarray:
    """1 si gana A, 0 si gana B y 0,5 si la diferencia es menor que el umbral."""
    d = (a - b) / np.maximum(np.abs(b), 1) if relativo else a - b
    return (d > umbral) + 0.5 * (np.abs(d) <= umbral)


def _gana(a: np.ndarray, b: np.ndarray, umbral: float = UMBRAL_PUNTOS, relativo: bool = False) -> float:
    return float(_gana_vector(a, b, umbral, relativo).mean())


def _factor_decisivo(vidas_a: list[Vida], vidas_b: list[Vida], fel_a: np.ndarray, fel_b: np.ndarray, minimo: int = 30) -> dict | None:
    """El hecho que más mueve quién gana: compara P(gana A) cuando ocurre y cuando no."""
    gana_a = _gana_vector(fel_a, fel_b)
    mejor = None
    for camino, vidas in (("a", vidas_a), ("b", vidas_b)):
        for hecho, texto in _HECHOS.items():
            if hecho == "recesion_temprana" and camino == "b":
                continue  # es del mundo: igual en ambos caminos
            ocurre = np.array([hecho in v.hechos for v in vidas])
            k = int(ocurre.sum())
            if k < minimo or len(vidas) - k < minimo:
                continue
            con, sin = float(gana_a[ocurre].mean()), float(gana_a[~ocurre].mean())
            if mejor is None or abs(con - sin) > abs(mejor["prob_a_con"] - mejor["prob_a_sin"]):
                mejor = {"hecho": hecho, "texto": texto, "camino": None if hecho == "recesion_temprana" else camino,
                         "frecuencia": k / len(vidas), "prob_a_con": con, "prob_a_sin": sin}
    return mejor


def comparar_en_mundo(cat: Catalogo, estado: dict, prioridades: dict, decision: str, opcion_a: str, opcion_b: str,
                      n: int, semilla: int, anios: int, politica: dict | None = None) -> dict:
    vidas_a = [vida_automatica(cat, estado, prioridades, semilla, i, anios, (decision, opcion_a), politica=politica) for i in range(n)]
    vidas_b = [vida_automatica(cat, estado, prioridades, semilla, i, anios, (decision, opcion_b), politica=politica) for i in range(n)]
    a, b = _resumen_vidas(vidas_a), _resumen_vidas(vidas_b)
    fel_a, fel_b = a.pop("_felicidad"), b.pop("_felicidad")
    ing_a, ing_b = a.pop("_ingreso"), b.pop("_ingreso")
    ind_a, ind_b = a.pop("_indicadores"), b.pop("_indicadores")
    p = _gana(fel_a, fel_b)
    muestra = np.linspace(0, n - 1, min(n, 80)).astype(int)
    orden_a, orden_b = np.sort(fel_a), np.sort(fel_b)
    a["muestra_felicidad"] = [round(float(x), 1) for x in orden_a[muestra]]
    b["muestra_felicidad"] = [round(float(x), 1) for x in orden_b[muestra]]
    return {
        "mundo": {"id": cat.mundo.id, "nombre": cat.mundo.nombre, "descripcion": cat.mundo.descripcion,
                  "ciclo": cat.mundo.ciclo, "tecnologia": cat.mundo.tecnologia},
        "a": a,
        "b": b,
        "prob_gana_a": p,
        "margen": _margen(p, n),
        "prob_gana_a_ingreso": _gana(ing_a, ing_b, UMBRAL_INGRESO, relativo=True),
        "prob_gana_a_por_indicador": {k: _gana(ind_a[k], ind_b[k]) for k in NOMBRES},
        "diferencia_felicidad_p50": float(np.median(fel_a - fel_b)),
        "factor_decisivo": _factor_decisivo(vidas_a, vidas_b, fel_a, fel_b),
        "_felicidad_a": orden_a,
        "_felicidad_b": orden_b,
    }


def percentil_en(orden: np.ndarray, valor: float) -> float:
    """En qué percentil cae `valor` dentro de una distribución ya ordenada."""
    return float(np.searchsorted(orden, valor, side="right")) / len(orden) * 100
