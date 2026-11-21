"""Empresas reales para las opciones de trabajo: le ponen nombre a la oferta, no cambian el resultado.

- Grandes y pymes: SII, Nómina de empresas personas jurídicas 2024 (`sii_empleadores.csv`).
- Avisos remotos desde el extranjero: Get on Board, API pública (`getonbrd_ofertas.csv`), con sueldo publicado.
- Startups: directorio de Y Combinator, startups con sede u operación en Chile (tabla `yc_chile` del paquete).
- El Estado: concursos de empleospublicos.cl 2025-2026 (`concursos_estado.csv`), con renta publicada.

Ningún número de aquí entra al motor: el sueldo y los riesgos de la opción siguen saliendo del
paquete. Las tablas se regeneran con `backend/scripts/datos_empresas.py`; ver `data/empresas/fuentes.json`.
Traído del PR #4 (`app/sim/empresas.py`) y adaptado al motor de gemelos.
"""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path
from random import Random

from app.sim.motor.paquete import Paquete

DATOS = Path(__file__).resolve().parents[3] / "data" / "empresas"

# (decisión, opción) -> tipo de empleador al que lleva. "actual" = mismo tamaño que el empleador de hoy.
TIPO_POR_OPCION: dict[tuple[str, str], str] = {
    ("primera_pega", "grande"): "grande",
    ("primera_pega", "pyme"): "pyme",
    ("primera_pega", "startup"): "startup",
    ("primera_pega", "estado"): "publico",
    ("unirse_a_startup", "ir"): "startup",
    ("remoto_para_afuera", "postular"): "extranjero",
    ("oferta_externa", "cambiar"): "actual",
    ("cesantia", "rapido"): "pyme",
    ("cesantia", "nivel"): "actual",
}
_SENIORITY = ["Junior", "Semi Senior", "Senior", "Expert", "Expert"]
_ESTAMENTO = {"universitaria": "Profesionales", "postgrado": "Profesionales", "tecnica": "Técnicos"}


@lru_cache
def _filas(nombre: str) -> tuple[dict, ...]:
    with open(DATOS / nombre, encoding="utf-8") as fh:
        return tuple(csv.DictReader(fh))


def _miles(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def _sii(tamano: str, e: dict, r: Random) -> dict | None:
    del_tamano = [f for f in _filas("sii_empleadores.csv") if f["tamano"] == tamano]
    # sin rubro (la primera pega): cualquiera del tamaño
    filas = [f for f in del_tamano if f["rubro"] == e.get("rubro")] if e.get("rubro") else del_tamano
    if tamano == "pyme":
        filas = [f for f in filas if f["region"] == e.get("region", "rm")] or filas
    if not filas:
        return None
    f = r.choice(filas)
    return {"tipo": tamano, "nombre": f["nombre"], "detalle": f"{_miles(int(f['trabajadores']))} trabajadores · {f['comuna']}",
            "fuente": "SII, nómina de empresas 2024"}


def _startup(pq: Paquete, r: Random) -> dict:
    f = r.choice(pq.filas("yc_chile"))
    return {"tipo": "startup", "nombre": f["nombre"],
            "detalle": f"startup de {f['industria']}, {f['tamano_equipo']} personas, Y Combinator {f['cohorte']}",
            "fuente": "Directorio de Y Combinator"}


def _publico(e: dict, r: Random) -> dict:
    estamento = _ESTAMENTO.get(e.get("edu", ""), "Administrativos")
    filas = [f for f in _filas("concursos_estado.csv") if f["estamento"] == estamento] or list(_filas("concursos_estado.csv"))
    f = r.choice(filas)
    return {"tipo": "publico", "nombre": f["servicio"], "cargo": f["cargo"][:90],
            "detalle": f"concurso con {f['postulaciones']} postulaciones · renta bruta ${_miles(float(f['renta_bruta']))}",
            "fuente": "Servicio Civil, empleospublicos.cl"}


def _remoto(e: dict, r: Random) -> dict | None:
    filas = [f for f in _filas("getonbrd_ofertas.csv") if f["remoto"] == "1" and f["chile"] == "0"]
    seniority = _SENIORITY[min(int(e.get("nivel", 0)), 4)]
    cerca = [f for f in filas if f["seniority"] == seniority] or filas
    if not cerca:
        return None
    f = r.choice(cerca)
    return {"tipo": "extranjero", "nombre": f["empresa"], "cargo": f["cargo"],
            "detalle": f"remoto · USD {_miles(float(f['min_usd']))} a {_miles(float(f['max_usd']))} brutos al mes",
            "url": f["url"], "fuente": "Get on Board"}


def para_opcion(pq: Paquete, decision: str, opcion: str, e: dict, semilla: int, anio: int) -> dict | None:
    """Una empresa real que encarna la opción, o None si la opción no lleva a un empleador.

    Es determinista: la misma partida (semilla, año, decisión) muestra siempre la misma empresa.
    """
    tipo = TIPO_POR_OPCION.get((decision, opcion))
    if tipo is None:
        return None
    r = Random(f"{semilla}:{anio}:{decision}:{opcion}")
    if tipo == "actual":
        tipo = e.get("tipo_empleador") if e.get("tipo_empleador") in ("grande", "pyme", "startup", "publico") else "pyme"
    if tipo in ("grande", "pyme"):
        return _sii(tipo, e, r)
    if tipo == "startup":
        return _startup(pq, r)
    if tipo == "publico":
        return _publico(e, r)
    return _remoto(e, r)
