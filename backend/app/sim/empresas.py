"""Empleadores y ofertas reales: de dónde sale cada empresa que aparece en el juego.

- Grandes y pymes: SII, Nómina de empresas personas jurídicas 2024 (`sii_empleadores.csv`).
- Avisos de tecnología y remotos: Get on Board, API pública (`getonbrd_ofertas.csv`), con sueldo publicado.
- Startups: directorio de Y Combinator, startups con sede u operación en Chile (tabla `yc_chile` del paquete).
- El Estado: concursos de empleospublicos.cl 2025-2026 (`concursos_estado.csv`), con renta publicada.

Las tablas se regeneran con `backend/scripts/datos_empresas.py`. Ver `data/empresas/fuentes.json`.
"""

from __future__ import annotations

import csv
from functools import lru_cache
from random import Random

from app.sim.catalogo import DATA
from app.sim.paquete import Paquete

# Categorías de Get on Board que calzan con cada rubro del juego.
_CATEGORIAS = {
    "Información y comunicaciones": {"Programming", "SysAdmin / DevOps / QA", "Data Science / Analytics", "Machine Learning & AI", "Cybersecurity",
                                      "Product, Innovation & Agile", "Technical Support", "Design / UX"},
    "Servicios profesionales": {"Data Science / Analytics", "Product, Innovation & Agile", "Operations / Admin"},
    "Finanzas y seguros": {"Data Science / Analytics", "Operations / Admin"},
    "Comercio": {"Sales", "Digital Marketing"},
}
_SENIORITY = ["Junior", "Semi Senior", "Senior", "Expert", "Expert"]


@lru_cache
def _filas(nombre: str) -> list[dict]:
    with open(DATA / "empresas" / nombre, encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def _miles(x: float) -> str:
    return f"{x:,.0f}".replace(",", ".")


def _sii(tamano: str, e: dict, r: Random) -> dict | None:
    filas = [f for f in _filas("sii_empleadores.csv") if f["tamano"] == tamano and f["rubro"] == e.get("rubro")]
    if tamano == "pyme":
        filas = [f for f in filas if f["region"] == e.get("region", "rm")] or filas
    if not filas:
        return None
    f = r.choice(filas)
    return {"tipo": tamano, "nombre": f["nombre"], "detalle": f"{_miles(int(f['trabajadores']))} trabajadores · {f['comuna']}",
            "razon_social": f["razon_social"], "fuente": "SII, nómina de empresas 2024"}


def aviso_getonbrd(e: dict, r: Random, solo_remoto: bool = False) -> dict | None:
    """Un aviso real de Get on Board para alguien del rubro y seniority de `e`, o None si no hay."""
    cats = _CATEGORIAS.get(e.get("rubro", ""))
    seniority = _SENIORITY[int(e.get("nivel", 0))]
    filas = _filas("getonbrd_ofertas.csv")
    if solo_remoto:
        filas = [f for f in filas if f["remoto"] == "1" and f["chile"] == "0"]
    else:
        filas = [f for f in filas if f["chile"] == "1"]
    if cats is not None:
        filas = [f for f in filas if f["categoria"] in cats] or (filas if solo_remoto else [])
    elif not solo_remoto:
        return None
    cerca = [f for f in filas if f["seniority"] == seniority] or filas
    if not cerca:
        return None
    f = r.choice(cerca)
    return {"tipo": "extranjero" if solo_remoto else "aviso", "nombre": f["empresa"], "cargo": f["cargo"],
            "detalle": f"{f['postulantes']} postulantes · USD {_miles(float(f['min_usd']))} a {_miles(float(f['max_usd']))} brutos",
            "usd": (float(f["min_usd"]) + float(f["max_usd"])) / 2, "url": f["url"], "fuente": "Get on Board"}


def contexto(pq: Paquete, tipo: str, e: dict, r: Random) -> dict | None:
    if tipo in ("grande", "pyme"):
        return _sii(tipo, e, r)
    if tipo == "startup":
        f = r.choice(pq.filas("yc_chile"))
        return {"tipo": "startup", "nombre": f["nombre"], "detalle": f"startup de {f['industria']}, {f['tamano_equipo']} personas, Y Combinator {f['cohorte']}",
                "fuente": "Directorio de Y Combinator"}
    if tipo == "publico":
        filas = [f for f in _filas("concursos_estado.csv") if f["estamento"] == e["estamento"]] or _filas("concursos_estado.csv")
        f = r.choice(filas)
        return {"tipo": "publico", "nombre": f["servicio"], "cargo": f["cargo"][:90], "renta_bruta": float(f["renta_bruta"]),
                "detalle": f"concurso con {f['postulaciones']} postulaciones", "fuente": "Servicio Civil, empleospublicos.cl"}
    if tipo == "extranjero":
        return aviso_getonbrd(e, r, solo_remoto=True)
    return None
