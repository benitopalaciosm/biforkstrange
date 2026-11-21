"""El mercado de cada temporada: las ofertas reales que le llegan al jugador.

Solo en la partida que juega una persona. Los gemelos que juegan solos siguen con las reglas
del paquete tal cual (cartas y eventos), que son las que están calibradas contra la EPS.

Cuántas ofertas llegan y cómo son sale del paquete:
- Con trabajo: cada uno de 3 intentos trae una oferta con la probabilidad de cambio de
  empleador de la EPS para tu edad (`P_CAMBIO_EMPLEADOR`), ajustada por tu red como en el
  evento `oferta_llega`. El sueldo sigue a `oferta_externa`: 54% de las veces mejora entre 5%
  y 25% (Banco Central), si no queda entre −15% y +2%.
- Sin trabajo: 2 intentos con la probabilidad de encontrar pega de `cesantia` (EPS), y el
  sueldo de volver «por menos» (78% a 90% del anterior).
- De qué tipo es el empleador: como `tipo_de_empleador` (ESI). Más una startup (peso de
  `unirse_a_startup`) y un remoto en dólares si cumples lo que pide `remoto_para_afuera`.

Quién es la empresa sale de datos reales (ver `empresas.py`). El Estado paga la renta del
concurso real y los avisos de Get on Board pagan lo que publican.
"""

from __future__ import annotations

import math
from dataclasses import replace
from random import Random
from typing import TYPE_CHECKING

from app.sim.catalogo import Decision, Efecto, Opcion, Resultado
from app.sim.empresas import aviso_getonbrd

if TYPE_CHECKING:
    from app.sim.motor import Alternativa, Vida

_SENIORITY = ["Junior", "Semi Senior", "Senior", "Jefatura", "Gerencia"]
# Cartas que el mercado reemplaza: los cambios de trabajo ahora llegan como ofertas con nombre.
REEMPLAZADAS = {"oferta_externa", "buscar_estando_empleado", "unirse_a_startup", "remoto_para_afuera", "cambiar_de_rubro"}


def _fija(var: str, valor) -> Efecto:
    return Efecto(var, "fija", lambda e, R, v=valor: v, None, None)


def _suma(var: str, valor) -> Efecto:
    return Efecto(var, "suma", lambda e, R, v=valor: v, None, None)


def decision_mercado(pregunta: str) -> Decision:
    uno = lambda e, R: 1  # noqa: E731
    return Decision(id="mercado", nombre="Mercado", categoria="trabajo", pregunta=pregunta, cuando=uno, tipo="carta", peso=uno, factor_peso=1.0,
                    opciones=[], calidad="mixto", creencia_vs_dato=None, evidencia=[])


def _tipo(v: "Vida", r: Random, pesos_extra: dict[str, float]) -> str:
    pq = v.cat.paquete
    mix = pq.k("MIX_EMPLEADOR")
    publico = pq.k("P_REEMPLEO_PUBLICO")
    pesos = {"publico": publico, "grande": (1 - publico) * mix["grande"], "pyme": (1 - publico) * mix["pyme"], **pesos_extra}
    u = r.random() * sum(pesos.values())
    for t, w in pesos.items():
        u -= w
        if u < 0:
            return t
    return "pyme"


def ofertas(v: "Vida", r: Random) -> list["Alternativa"]:
    from app.sim.motor import Alternativa

    e, pq, cat = v.e, v.cat.paquete, v.cat
    empleado = e["estado"] == "empleado"
    if empleado:
        p = min(0.6, pq.k("P_CAMBIO_EMPLEADOR", e["banda3"]) * 1.5 * (1 + e["red"] / 100))
        intentos = 3
    else:
        base = (1 - math.exp(-12 / pq.k("MESES_CESANTIA", e["banda3"]))) * (pq.k("PENAL_HUECO") if e["hueco"] else 1)
        base *= (0.85 if e["recesion"] else 1) * (1 + (e["red"] - 30) / 400) * e["p_encontrar"] * cat.mundo.encontrar(e, r)
        p = min(0.95, max(0.08, base))
        intentos = 2
    extra = {}
    if empleado and e["tipo_empleador"] != "startup" and e["edad"] <= 45:
        extra["startup"] = 0.04 + e["riesgo"] / 1500
    remoto = cat.decisiones["remoto_para_afuera"]
    if empleado and remoto.cuando(e, r) and e["tipo_empleador"] != "extranjero":
        extra["extranjero"] = 0.15 + (0.1 if e["ingles"] else 0)

    out: list[Alternativa] = []
    usados: set[str] = set()
    for i in range(intentos):
        if r.random() >= p:
            continue
        tipo = _tipo(v, r, extra)
        if tipo == "extranjero" and "extranjero" in usados:
            tipo = "pyme"
        alt = _oferta(v, r, tipo, i, empleado)
        if alt is not None and alt.nombre not in usados:
            usados.add(alt.nombre)
            usados.add(tipo if tipo in ("extranjero", "startup") else alt.nombre)
            out.append(alt)
    return out


def _oferta(v: "Vida", r: Random, tipo: str, i: int, empleado: bool) -> "Alternativa | None":
    from app.sim.motor import Alternativa

    e, pq, cat = v.e, v.cat.paquete, v.cat
    ref = e["sueldo"] if empleado else e["sueldo_ref"]
    cargo = v.cargo or "Profesional"
    seniority = _SENIORITY[int(e["nivel"])]
    efectos_base = [_fija("antiguedad", 0)] + ([] if empleado else [_fija("meses_cesante", 0), _suma("animo", pq.k("ANIMO_REEMPLEO"))])

    if tipo == "startup":
        empresa = v.empresa("startup", clave=f"oferta{i}")
        ir = next(o for o in cat.decisiones["unirse_a_startup"].opciones if o.id == "ir")
        resultados = [replace(res, efectos=[_fija("estado", "empleado"), *res.efectos, *efectos_base], texto_al_ocurrir=f"Te vas a {empresa['nombre']} con acciones.")
                      for res in ir.resultados]
        sueldo, detalle, calidad, fuentes = ref * 0.9, "10% menos de sueldo y acciones", ir.calidad, ir.fuentes + ["yc_directorio"]
        aviso = None
    else:
        aviso = None
        if tipo == "extranjero":
            empresa = aviso_getonbrd(e, r, solo_remoto=True)
            if empresa is None:
                return None
            sueldo = empresa["usd"] * pq.k("USD") * pq.k("LIQUIDO")
            cargo = empresa["cargo"]
        elif tipo == "publico":
            empresa = v.empresa("publico", clave=f"oferta{i}")
            sueldo = empresa["renta_bruta"] * pq.k("LIQUIDO")
            cargo = empresa["cargo"]
        else:
            aviso = aviso_getonbrd(e, r) if r.random() < (0.5 if e["rubro"] == "Información y comunicaciones" else 0.25) else None
            empresa = aviso or v.empresa(tipo, clave=f"oferta{i}")
            if empresa is None:
                return None
            if aviso:
                sueldo = aviso["usd"] * pq.k("USD") * pq.k("LIQUIDO")
                cargo = aviso["cargo"]
                empresa = {**aviso, "tipo": tipo}
            elif empleado:
                mejora = r.random() < pq.k("P_SUBE_CAMBIO")
                sueldo = ref * (r.uniform(1.05, 1.25) if mejora else r.uniform(0.85, 1.02))
            else:
                sueldo = ref * r.uniform(0.78, 0.9) * (0.93 if e["hueco"] else 1)
        resultados = [Resultado(
            id="entras", prob=None, texto=f"Entras a {empresa['nombre']}.", tono="bueno" if sueldo >= ref else "neutro",
            efectos=[_fija("estado", "empleado"), _fija("tipo_empleador", "extranjero" if tipo == "extranjero" else tipo),
                     *([_fija("remoto", 1)] if tipo == "extranjero" else []), *([_fija("rubro", "Administración pública")] if tipo == "publico" else []),
                     _fija("sueldo", round(sueldo)), *efectos_base],
            luego=None,
        )]
        detalle = cargo
        calidad = "dato" if tipo in ("publico", "extranjero") or aviso else "mixto"
        fuentes = ["ine_esi_2025", "bcentral_2018"] if calidad == "mixto" else []

    oferta = {"tipo": tipo, "empresa": empresa["nombre"], "cargo": cargo if tipo != "startup" else f"{cargo} · {seniority}", "seniority": seniority,
              "sueldo": round(sueldo), "cambio": round(sueldo / ref - 1, 3) if ref else None, "detalle": empresa.get("detalle", ""),
              "fuente": empresa.get("fuente", ""), "url": empresa.get("url")}
    opcion = Opcion(id="oferta", nombre=empresa["nombre"], detalle=detalle, requisito=None, resultados=resultados, calidad=calidad, fuentes=fuentes)
    return Alternativa(f"oferta:{i}", opcion, empresa["nombre"], oferta=oferta, empleador={**empresa, "cargo": cargo})


def quedarse(v: "Vida") -> "Alternativa":
    from app.sim.motor import Alternativa

    donde = (v.empleador or {}).get("nombre") or "tu pega"
    res = Resultado(id="te_quedas", prob=None, texto=f"Sigues en {donde}.", tono="neutro", efectos=[], luego=None)
    return Alternativa("quedarse", Opcion(id="quedarse", nombre=f"Seguir en {donde}", detalle="", requisito=None, resultados=[res], calidad="supuesto", fuentes=[]),
                       f"Seguir en {donde}")
