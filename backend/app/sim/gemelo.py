"""Arma el estado inicial del gemelo a partir del perfil que entrega la persona.

El perfil trae lo que se sabe (edad, estudios, trabajo, sueldo). Lo demás se completa con
el campo `inicio` de `estado.json` y con `perfil_por_omision` de `juego.json`.
"""

from __future__ import annotations

from random import Random

from app.sim.catalogo import VARIABLES_MOTOR, Catalogo, valor_inicial

EDAD_TITULO = {"media": 18, "tecnica": 21, "universitaria": 24, "postgrado": 26}
_PERFIL_BASE = {
    "primer_empleo": 0, "carrera_id": -1, "area": "", "tipo_institucion": "", "region": "rm", "pareja": "no", "hijos": 0,
    "edad_hijo_menor": -1, "ahorro": 0, "riesgo": 50, "ambicion": 50, "ingles": 0, "isapre": 0, "propietario": 0,
    "ocupacion": 2, "nivel": 0, "antiguedad": 0, "tipo_empleador": "", "rubro": "", "sueldo": 0,
}
_OTROS = {"pais": "chile", "salud": "bien", "semestres_restantes": 0}


def estado_inicial(cat: Catalogo, perfil: dict) -> dict:
    pq = cat.paquete
    e: dict = {}
    for nombre, v in pq.variables.items():
        inicio = v.get("inicio")
        if inicio in ("deriva", "perfil"):
            continue
        if v["tipo"] == "eleccion":
            e[nombre] = ""
            continue
        literal = valor_inicial(inicio)
        if literal is not None:
            e[nombre] = literal
    e.update(_OTROS)
    e.update(_PERFIL_BASE)
    e.update(VARIABLES_MOTOR)
    e.update({k: v for k, v in perfil.items() if v is not None})

    if perfil.get("anos_titulado") is None:
        e["anos_titulado"] = max(0, e["edad"] - EDAD_TITULO[e["edu"]])
    if e["estado"] != "empleado":
        e["sueldo"], e["antiguedad"] = 0, 0  # tipo_empleador y rubro quedan como los del último trabajo
        e["sueldo_ref"] = perfil.get("sueldo_ref") or perfil.get("sueldo") or 0
    else:
        e["sueldo_ref"] = e["sueldo"]
    if e["hijos"] == 0:
        e["edad_hijo_menor"] = -1
    elif e["edad_hijo_menor"] < 0:
        e["edad_hijo_menor"] = 5
    e["madre_edad"] = e["edad"] + round(pq.k("EDAD_MADRE"))
    e["padre_edad"] = e["madre_edad"] + 2

    omision = cat.juego["perfil_por_omision"]
    for var in ("skill", "red", "horas"):
        if perfil.get(var) is None:
            e[var] = pq.evaluar(omision[var], e, Random(0))

    # Ahorro y gasto parten del percentil de ingreso: se derivan con el sueldo de referencia.
    e["gasto_mensual"] = 0
    e["tasa_ahorro"] = 0
    referencia = pq.derivar({**e, "sueldo": e["sueldo"] or e["sueldo_ref"]})
    q = referencia["quintil"]
    e["gasto_mensual"] = round(pq.tabla("epf_quintiles", "gasto_hogar", "quintil", q) / pq.tabla("epf_quintiles", "personas_por_hogar", "quintil", q))
    p = referencia["percentil"]
    e["tasa_ahorro"] = pq.k("TASA_AHORRO", "p80+" if p >= 80 else "p50-79" if p >= 50 else "p0-49")
    return pq.derivar(e)
