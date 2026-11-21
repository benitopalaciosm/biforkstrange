"""Catálogo del juego: lo que se usa del paquete, con sus expresiones ya compiladas.

`data/juego.json` dice qué decisiones y eventos entran, qué parches se aplican y qué reglas
agrega el motor. `data/mundos.json` define los mundos. Hay un `Catalogo` por mundo porque
las expresiones compiladas quedan atadas a los parámetros de ese mundo.
"""

from __future__ import annotations

import copy
import json
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.sim.paquete import Expresion, Paquete, paquete_base

DATA = Path(__file__).resolve().parents[2] / "data"

# Variables que agrega el motor y no están en estado.json.
VARIABLES_MOTOR = {"exit_en": 0, "destino_startup": 0}


@dataclass(slots=True)
class Efecto:
    var: str
    op: str
    valor: Expresion
    duracion: int | None
    cuando: Expresion | None


@dataclass(slots=True)
class Resultado:
    id: str
    prob: Expresion | None  # None = 'resto'
    texto: str
    tono: str
    efectos: list[Efecto]
    luego: str | None
    texto_al_ocurrir: str | None = None


@dataclass(slots=True)
class Opcion:
    id: str
    nombre: str
    detalle: str
    requisito: Expresion | None
    resultados: list[Resultado]
    calidad: str
    fuentes: list[str]


@dataclass(slots=True)
class Decision:
    id: str
    nombre: str
    categoria: str
    pregunta: str
    cuando: Expresion
    tipo: str  # forzada | carta | interna
    peso: Expresion
    factor_peso: float
    opciones: list[Opcion]
    calidad: str
    creencia_vs_dato: str | None
    evidencia: list[dict]


@dataclass(slots=True)
class Evento:
    id: str
    nombre: str
    categoria: str
    cuando: Expresion
    prob_anual: Expresion
    resultados: list[Resultado]
    calidad: str
    fuentes: list[str]


@dataclass(slots=True)
class Mundo:
    id: str
    nombre: str
    descripcion: str
    ciclo: str
    tecnologia: str
    separacion: Expresion
    encontrar: Expresion
    alza: Expresion


@dataclass
class Catalogo:
    paquete: Paquete
    juego: dict
    mundo: Mundo
    decisiones: dict[str, Decision] = field(default_factory=dict)
    forzadas: list[Decision] = field(default_factory=list)
    cartas: list[Decision] = field(default_factory=list)
    eventos_mundo: list[Evento] = field(default_factory=list)
    eventos: list[Evento] = field(default_factory=list)
    evento_por_id: dict[str, Evento] = field(default_factory=dict)
    prob_ascenso: tuple[Expresion, Expresion] | None = None
    costo_sin_ingreso: Expresion | None = None
    venta_startup: Expresion | None = None
    limites: dict[str, tuple[float, float]] = field(default_factory=dict)


@lru_cache
def cargar_juego() -> dict:
    return json.loads((DATA / "juego.json").read_text(encoding="utf-8"))


@lru_cache
def cargar_mundos() -> dict:
    return json.loads((DATA / "mundos.json").read_text(encoding="utf-8"))


def ids_mundos() -> list[str]:
    return [m["id"] for m in cargar_mundos()["mundos"]]


def _parchar(decisiones: dict[str, dict], parches: list[dict]) -> dict[str, dict]:
    """Devuelve una copia de las decisiones con los parches de juego.json aplicados."""
    out = copy.deepcopy(decisiones)
    for p in parches:
        opcion = next(o for o in out[p["decision"]]["opciones"] if o["id"] == p["opcion"])
        res = next(r for r in opcion["resultados"] if r["id"] == p["resultado"])
        if "texto_al_ocurrir" in p:  # la carta muestra el desenlace posible; la bitácora, lo que se sabe ese año
            res["texto_al_ocurrir"] = p["texto_al_ocurrir"]
        quitar = set(p.get("quitar_efectos", []))
        if quitar and not any(e["var"] in quitar for e in res["efectos"]):
            raise ValueError(f"parche sin efecto que quitar: {p['decision']}/{p['opcion']}/{p['resultado']}")
        res["efectos"] = [e for e in res["efectos"] if e["var"] not in quitar] + p.get("agregar_efectos", [])
    return out


def _resultados(pq: Paquete, crudos: list[dict]) -> list[Resultado]:
    return [
        Resultado(
            id=r["id"],
            prob=None if r["prob"] == "resto" else pq.compilar(r["prob"]),
            texto=r["texto"],
            tono=r.get("tono", "neutro"),
            efectos=[
                Efecto(e["var"], e["op"], pq.compilar(e["valor"]), e.get("duracion"), pq.compilar(e["cuando"]) if e.get("cuando") else None)
                for e in r["efectos"]
            ],
            luego=r.get("luego"),
            texto_al_ocurrir=r.get("texto_al_ocurrir"),
        )
        for r in crudos
    ]


def _construir(mundo_def: dict) -> Catalogo:
    juego = cargar_juego()
    pq = paquete_base().con_parametros(mundo_def.get("parametros", {}))
    mult = mundo_def["multiplicadores"]
    mundo = Mundo(
        id=mundo_def["id"],
        nombre=mundo_def["nombre"],
        descripcion=mundo_def["descripcion"],
        ciclo=mundo_def.get("ciclo", ""),
        tecnologia=mundo_def.get("tecnologia", ""),
        separacion=pq.compilar(mult["separacion"]),
        encontrar=pq.compilar(mult["encontrar"]),
        alza=pq.compilar(mult["alza"]),
    )
    cat = Catalogo(paquete=pq, juego=juego, mundo=mundo)

    crudas = _parchar(pq.decisiones, juego["parches"])
    excluidas = juego["opciones_excluidas"]
    extra = juego.get("condiciones_extra", {})
    factor = juego["pesos_categoria"]
    for did in juego["decisiones"]:
        d = crudas[did]
        cuando = d["cuando"]
        if did in extra:
            cuando = f"y({cuando}, {extra[did]['cuando']})"
        dec = Decision(
            id=did,
            nombre=d["nombre"],
            categoria=d["categoria"],
            pregunta=d["pregunta"],
            cuando=pq.compilar(cuando),
            tipo=d["aparicion"]["tipo"],
            peso=pq.compilar(d["aparicion"]["peso"]),
            factor_peso=float(factor.get(d["categoria"], 1)) * float(juego["pesos_decision"].get(did, 1)),
            opciones=[
                Opcion(
                    id=o["id"],
                    nombre=o["nombre"],
                    detalle=o.get("detalle", ""),
                    requisito=pq.compilar(o["requisito"]) if o.get("requisito") else None,
                    resultados=_resultados(pq, o["resultados"]),
                    calidad=o.get("calidad", "supuesto"),
                    fuentes=o.get("fuentes", []),
                )
                for o in d["opciones"]
                if o["id"] not in excluidas.get(did, [])
            ],
            calidad=d.get("calidad", "supuesto"),
            creencia_vs_dato=d.get("creencia_vs_dato"),
            evidencia=d.get("evidencia", []),
        )
        cat.decisiones[did] = dec
        if dec.tipo == "forzada":
            cat.forzadas.append(dec)
        elif dec.tipo == "carta":
            cat.cartas.append(dec)

    for eid in juego["eventos"]:
        x = pq.eventos[eid]
        ev = Evento(
            id=eid,
            nombre=x["nombre"],
            categoria=x["categoria"],
            cuando=pq.compilar(x["cuando"]),
            prob_anual=pq.compilar(x["prob_anual"]),
            resultados=_resultados(pq, x["resultados"]),
            calidad=x.get("calidad", "supuesto"),
            fuentes=x.get("fuentes", []),
        )
        cat.evento_por_id[eid] = ev
        (cat.eventos_mundo if ev.categoria == "mundo" and eid == "recesion" else cat.eventos).append(ev)

    asc = pq.eventos["ascenso"]
    cat.prob_ascenso = (pq.compilar(asc["cuando"]), pq.compilar(asc["prob_anual"]))
    reglas = juego["reglas_motor"]
    cat.costo_sin_ingreso = pq.compilar(reglas["costo_sin_ingreso"])
    cat.venta_startup = pq.compilar(reglas["venta_startup"])
    for nombre, v in pq.variables.items():
        dom = v.get("dominio") or []
        if v["tipo"] in ("numero", "entero", "modificador") and len(dom) == 2 and all(isinstance(x, (int, float)) for x in dom):
            cat.limites[nombre] = (dom[0], dom[1])
    return cat


@lru_cache
def catalogo(mundo_id: str) -> Catalogo:
    mundos = cargar_mundos()
    if mundo_id == mundos["referencia"]["id"]:
        return _construir(mundos["referencia"])
    for m in mundos["mundos"]:
        if m["id"] == mundo_id:
            return _construir(m)
    raise KeyError(f"mundo desconocido: {mundo_id}")


def valor_inicial(inicio: Any) -> Any:
    """Lee el campo `inicio` de estado.json cuando es un literal."""
    if isinstance(inicio, (int, float)):
        return inicio
    if inicio == "''":
        return ""
    try:
        return int(inicio)
    except (TypeError, ValueError):
        try:
            return float(inicio)
        except (TypeError, ValueError):
            return None
