"""Calibración: una cohorte de gemelos que juegan solos, comparada con Chile.

Simula personas de 30 años que parten con la mezcla de educación, sexo, tipo de empleador,
rubro y sueldo de la ESI 2025, las deja vivir 15 años con los parámetros del paquete (mundo
`referencia`) y mide lo que `objetivos_validacion.json` pide para esas edades.

Sirve para dos cosas: revisar que el motor no se aleje de los datos y mostrarle al jurado
qué calza y qué no.
"""

from __future__ import annotations

from functools import lru_cache
from random import Random

import numpy as np

from app.sim.catalogo import catalogo
from app.sim.gemelo import estado_inicial
from app.sim.montecarlo import vida_automatica

_EDU = [("media", 0.5003), ("tecnica", 0.1638), ("universitaria", 0.3149), ("postgrado", 0.0209)]
_CAMBIO = {("oferta_externa", "mejora"), ("oferta_externa", "igual_o_peor"), ("oferta_externa", "te_vas"), ("separacion_empleo", "reemplea")}
_PRIORIDADES = {"dinero": 25, "carrera": 25, "bienestar": 25, "vida_personal": 25}


def _sortear(r: Random, opciones: list[tuple[str, float]]) -> str:
    u = r.random() * sum(w for _, w in opciones)
    for valor, w in opciones:
        u -= w
        if u < 0:
            return valor
    return opciones[-1][0]


def _sueldo(r: Random, cuantiles: list[float]) -> float:
    """Sortea un sueldo que respeta p10, p25, p50, p75 y p90 de la ESI."""
    qs = [0.0, 0.10, 0.25, 0.50, 0.75, 0.90, 1.0]
    vs = [cuantiles[0] * 0.6, *cuantiles, cuantiles[4] * 1.5]
    u = r.random()
    for i in range(6):
        if u <= qs[i + 1]:
            return vs[i] + (vs[i + 1] - vs[i]) * (u - qs[i]) / (qs[i + 1] - qs[i])
    return vs[-1]


def _cohorte(n: int, semilla: int) -> list[dict]:
    cat = catalogo("referencia")
    pq = cat.paquete
    r = Random(semilla)
    dominio = set(pq.variables["rubro"]["dominio"])
    rubros = [(f["rubro"], float(f["share_ocupados_banda"])) for f in pq.filas("esi_ingreso_rubro_edad")
              if f["banda_edad"] == "30-34" and f["rubro"] in dominio and f["rubro"] != "Administración pública" and f["share_ocupados_banda"]]
    mix = pq.k("MIX_EMPLEADOR")
    privados = [(t, mix[t]) for t in ("grande", "pyme", "startup")]
    perfiles = []
    for _ in range(n):
        edu = _sortear(r, _EDU)
        publico = r.random() < pq.k("P_REEMPLEO_PUBLICO")
        perfiles.append({
            "edad": 30, "sexo": "h" if r.random() < 0.55 else "m", "edu": edu, "estado": "empleado",
            "tipo_empleador": "publico" if publico else _sortear(r, privados),
            "rubro": "Administración pública" if publico else _sortear(r, rubros),
            "nivel": 1, "antiguedad": r.randint(0, 6), "sueldo": round(_sueldo(r, pq.cuantiles_esi(edu, "30-34"))),
            "pareja": "convive" if r.random() < 0.62 else "no", "riesgo": r.uniform(20, 80),
        })
    return perfiles


@lru_cache(maxsize=4)
def calibrar(n: int = 1500, semilla: int = 2026, anios: int = 15) -> dict:
    cat = catalogo("referencia")
    pq = cat.paquete
    objetivos = {o["id"]: o for o in pq.objetivos}
    anos_empleado = separaciones = cambios = 0
    ocupado = buscando = 0
    episodios = siguen = 0
    sueldos: dict[tuple[str, str], list[float]] = {}
    por_banda: dict[str, list[float]] = {}
    publico = asalariado = 0

    for i, perfil in enumerate(_cohorte(n, semilla)):
        vida = vida_automatica(cat, estado_inicial(cat, perfil), _PRIORIDADES, semilla, i, anios, detalle=True)
        empleado_al_inicio = True
        for a in vida.anios:
            edad = a["edad"]
            banda = f"{5 * (edad // 5)}-{5 * (edad // 5) + 4}"
            hechos = {(x["id"], x["resultado"]) for x in a["eventos"]}
            if empleado_al_inicio and edad < 45:
                anos_empleado += 1
                separaciones += any(h[0] == "separacion_empleo" for h in hechos)
                cambios += bool(hechos & _CAMBIO)
            for x in a["eventos"]:
                if x["id"] == "cesantia" and x.get("origen") == "forzada":
                    pass
            if a["estado"] in ("empleado", "fundador", "independiente"):
                ocupado += 1
                if a["sueldo"] > 0:
                    sueldos.setdefault((a["edu"], banda), []).append(a["sueldo"])
                    por_banda.setdefault(banda, []).append(a["sueldo"])
                if a["estado"] == "empleado":
                    asalariado += 1
                    publico += a["tipo_empleador"] == "publico"
            elif a["estado"] == "buscando":
                buscando += 1
            empleado_al_inicio = a["estado"] == "empleado"
        # Episodios de cesantía: el año siguiente a quedar cesante, ¿sigue buscando?
        estados = [a["estado"] for a in vida.anios]
        for t in range(1, len(estados) - 1):
            if estados[t] == "buscando" and estados[t - 1] != "buscando":
                episodios += 1
                siguen += estados[t + 1] == "buscando"

    filas = []

    def fila(grupo, indicador, simulado, objetivo, fuente, tolerancia=None, relativa=None, nota=""):
        if relativa is not None:
            calza = abs(simulado / objetivo - 1) <= relativa
        else:
            calza = abs(simulado - objetivo) <= tolerancia
        filas.append({"grupo": grupo, "indicador": indicador, "simulado": simulado, "objetivo": objetivo, "fuente": fuente,
                      "tolerancia": tolerancia, "tolerancia_relativa": relativa, "calza": bool(calza), "nota": nota})

    o = objetivos["separacion_30_44"]
    fila("Trayectorias", o["indicador"], separaciones / anos_empleado, o["valor"], o["fuente"], o["tolerancia"])
    o = objetivos["cambio_30_44"]
    fila("Trayectorias", o["indicador"], cambios / anos_empleado, o["valor"], o["fuente"], o["tolerancia"])
    o = objetivos["sigue_cesante_12m"]
    fila("Trayectorias", o["indicador"], siguen / max(episodios, 1), o["valor"], o["fuente"], o["tolerancia"], nota=f"{episodios} episodios simulados")
    desoc = objetivos["desocupacion_35-39"]["valor"] * 0.5 + objetivos["desocupacion_40-44"]["valor"] * 0.25 + objetivos["desocupacion_30-34"]["valor"] * 0.25
    fila("Empleo", "Desocupación, 30-44", buscando / (ocupado + buscando), round(desoc, 4), "ine_esi_2025", 0.03,
         nota="Objetivo: promedio de las bandas 30-34, 35-39 y 40-44 ponderado por los años simulados")
    for banda in ("35-39", "40-44"):
        for edu in ("media", "tecnica", "universitaria"):
            vals = sueldos.get((edu, banda), [])
            if len(vals) >= 100:
                fila("Sueldos", f"Sueldo mediano, {edu}, {banda}", float(np.median(vals)),
                     pq.tabla("esi_perfil_edad_edu", "p50", "educacion", edu, "banda", banda), "ine_esi_2025", relativa=0.15)
    o = objetivos["publico_35-39"]
    fila("Tipo de trabajo", "Asalariados públicos entre asalariados", publico / max(asalariado, 1), o["valor"], o["fuente"], 0.05,
         nota="El objetivo de la ESI es sobre todos los ocupados; aquí no hay cuenta propia")

    return {
        "cohorte": {"personas": n, "anios": anios, "edad_inicial": 30, "mundo": "referencia", "semilla": semilla},
        "indicadores": filas,
        "calzan": sum(f["calza"] for f in filas),
        "total": len(filas),
        "no_modelado": [
            "Trabajo por cuenta propia (13% a 24% de los ocupados en Chile): el paquete declara que falta.",
            "Enfermedades, muertes en la familia y cuidados: fuera del alcance del juego.",
            "La cohorte parte a los 30 con trabajo: no se valida la entrada al mercado laboral.",
        ],
    }
