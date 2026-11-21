"""Tus gemelos: la misma persona, la misma decisión, otra suerte.

Para una decisión, cada gemelo vive una vez con cada opción y con los mismos
dados. Después de esa decisión no buscan más cambios (`Inercia`), así que la
diferencia entre opciones es el efecto de esta decisión y no de otras diez.
"""

from collections import Counter
from statistics import median, quantiles

from app.sim.motor.azar import Dados
from app.sim.motor.motor import Vida
from app.sim.motor.perfil import NIVELES
from app.sim.motor.politicas import Fija, Inercia, opcion_base, parametros_por_defecto

N_GEMELOS = 500
HORIZONTE = 10
IGUAL = 0.005  # dos sueldos a menos de 0,5% se cuentan como iguales


def _rango(valores: list[float]) -> dict:
    if len(valores) < 2:
        v = round(valores[0]) if valores else 0
        return {"p10": v, "p50": v, "p90": v}
    q = quantiles(valores, n=10, method="inclusive")
    return {"p10": round(q[0]), "p50": round(q[4]), "p90": round(q[8])}


def _vivir(vida: Vida, decision_id: str, opcion: str, parametros: dict, anios: int) -> Vida:
    """Toma la opción y vive hasta cumplir `anios` años más (un doctorado ocupa varios)."""
    decisor = Fija(decision_id, opcion, parametros, Inercia())
    edad_final = vida.e["edad"] + anios
    if not vida.cola:
        vida.iniciar_anio(con_cartas=False, carta=decision_id)
    vida.avanzar(decisor)
    while vida.e["edad"] < edad_final and not vida.terminada():
        vida.vivir_anio(decisor)
    return vida


def _contra_base(pares: list[tuple[float, float]]) -> dict:
    """Cada gemelo contra sí mismo con la opción base: gana más, igual o menos, y por cuánto."""
    n = len(pares)
    if not n:
        return {"gana_mas_que_base": None, "igual_que_base": None, "gana_menos_que_base": None,
                "diferencia_tipica": None, "diferencia_si_cambia": None}
    mas = sum(1 for a, b in pares if a > b * (1 + IGUAL))
    menos = sum(1 for a, b in pares if a < b * (1 - IGUAL))
    distintos = [a - b for a, b in pares if a > b * (1 + IGUAL) or a < b * (1 - IGUAL)]
    return {
        "gana_mas_que_base": mas / n, "igual_que_base": (n - mas - menos) / n, "gana_menos_que_base": menos / n,
        "diferencia_tipica": round(median(a - b for a, b in pares)),  # del gemelo del medio, en pesos al mes
        # lo mismo, pero solo entre los mundos donde la opción cambia algo (sin los empates)
        "diferencia_si_cambia": round(median(distintos)) if distintos else 0,
    }


def comparar(vida: Vida, decision_id: str, *, n: int = N_GEMELOS, anios: int = HORIZONTE, semilla: int = 0,
             parametros: dict[str, dict] | None = None, crudo: bool = False) -> dict:
    """Simula `n` gemelos por cada opción de la decisión, desde el punto en que está `vida`.

    `vida` puede estar al inicio de un año o detenida en esa decisión; no se modifica.
    `parametros` da, por opción, lo que se elige dentro de ella (p. ej. el rubro de destino);
    si falta, se usa la alternativa donde hay más gente. `crudo` agrega el sueldo final de cada gemelo.
    """
    pq = vida.pq
    decision = pq.decisiones[decision_id]
    opciones = vida.opciones(decision_id)
    parametros = parametros or {}
    anio0, buscando0, ingreso0 = len(vida.historia), vida.anios_buscando, vida.ingreso_total
    usados = {o.id: parametros.get(o.id) or parametros_por_defecto(vida, o) for o in opciones}
    finales: dict[str, list[Vida]] = {
        o.id: [_vivir(vida.clonar(Dados(semilla, g)), decision_id, o.id, usados[o.id], anios) for g in range(n)]
        for o in opciones
    }

    def primer_resultado(v: Vida) -> str | None:
        for d in v.historia[anio0]["decisiones"]:
            if d["decision"] == decision_id:
                return d["resultado"]
        return None

    base = opcion_base(decision, opciones)
    sueldos_base = [round(v.sueldo_o_ultimo()) for v in finales[base]]
    salida = []
    for o in opciones:
        vidas = finales[o.id]
        sueldos = [round(v.sueldo_o_ultimo()) for v in vidas]  # en pesos, igual que la trayectoria
        niveles = Counter(v.e["nivel"] for v in vidas)
        es_base = o.id == base
        resultados = [primer_resultado(v) for v in vidas]
        definiciones = {r["id"]: r for r in o.resultados}
        por_resultado = []
        for rid, cuantos in Counter(resultados).most_common():
            pares = [] if es_base else [(s, b) for s, b, r in zip(sueldos, sueldos_base, resultados) if r == rid]
            por_resultado.append({
                "resultado": rid, "texto": definiciones.get(rid, {}).get("texto", ""),
                "tono": definiciones.get(rid, {}).get("tono", "neutro"),
                "gemelos": cuantos, "prob": cuantos / n, **_contra_base(pares),
            })
        trayectoria = []
        for i in range(anios):
            del_anio = [v.historia[anio0 + i]["fin"] for v in vidas if len(v.historia) > anio0 + i]
            if len(del_anio) < n / 2:
                break
            trayectoria.append({
                "edad": round(median(f["edad"] for f in del_anio)),
                **_rango([f["sueldo"] or f["sueldo_ref"] for f in del_anio]),
                "sin_trabajo": sum(1 for f in del_anio if f["estado"] == "buscando") / len(del_anio),
            })
        salida.append({
            "opcion": o.id, "nombre": o.nombre, "detalle": o.detalle, "calidad": o.calidad,
            "es_base": es_base, "parametros": usados[o.id],
            "sueldo": _rango(sueldos),
            "ingreso_total": _rango([v.ingreso_total - ingreso0 for v in vidas]),
            "paso_por_cesantia": sum(1 for v in vidas if v.anios_buscando > buscando0) / n,
            "meses_sin_trabajo": 12 * sum(v.anios_buscando - buscando0 for v in vidas) / n,
            "sin_trabajo_al_final": sum(1 for v in vidas if v.e["estado"] == "buscando") / n,
            "cargo_mas_probable": NIVELES[niveles.most_common(1)[0][0]],
            "cargos": [{"cargo": NIVELES[k], "prob": c / n} for k, c in sorted(niveles.items())],
            **_contra_base([] if es_base else list(zip(sueldos, sueldos_base))),
            "por_resultado": por_resultado,
            "trayectoria": trayectoria,
            **({"sueldos": sorted(round(x) for x in sueldos)} if crudo else {}),
        })
    return {
        "decision": decision_id, "nombre": decision["nombre"], "pregunta": decision["pregunta"],
        "calidad": decision["calidad"], "creencia_vs_dato": decision.get("creencia_vs_dato"),
        "evidencia": decision.get("evidencia", []),
        "gemelos": n, "anios": anios, "base": base, "opciones": salida,
    }
