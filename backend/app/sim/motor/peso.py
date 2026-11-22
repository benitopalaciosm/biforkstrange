"""Cuánto pesa cada línea de tu CV en tu duda, y cuál de tus dudas tiene más en juego.

Todo sale de repetir `gemelos.comparar` con la misma semilla: los mismos dados,
otro perfil. Así la diferencia es el efecto de ese dato y no de otra suerte.
Aquí no se narra nada; el cliente arma las frases con estos números.
"""

from dataclasses import replace
from functools import lru_cache

from app.sim.motor import gemelos, partida
from app.sim.motor.perfil import Perfil

MAX_DATOS = 4  # cuántas líneas del CV se muestran: las que más mueven
MIN_CAMBIO = 0.01  # bajo esto (1 mundo de 100, o 1% del sueldo) el dato no mueve la duda
GANA_VISIBLE = 0.05  # desde 5 mundos de 100, lo que se cuenta es en cuántos gana (se entiende mejor que un sueldo)


def _neutro(campo: str, perfil: Perfil):
    """El valor que el motor usaría si el CV no dijera nada de ese campo; None si la persona ya lo tiene."""
    valor = getattr(perfil, campo)
    if campo in ("ingles", "usa_ia", "remoto", "parcial", "empresa_fondos"):
        return 0 if valor else None
    if campo in ("skill", "red", "anos_por_empleo"):
        return None if valor is None else "sin_dato"
    if campo == "nivel":  # sin el último ascenso: el cargo de entrada típico (Semi senior)
        return 1 if valor > 1 else None
    if campo == "edu":  # sin el último título
        return {"postgrado": "universitaria", "universitaria": "media", "tecnica": "media"}.get(valor)
    return None


CAMPOS = ("ingles", "skill", "red", "usa_ia", "remoto", "anos_por_empleo", "nivel", "edu", "parcial", "empresa_fondos")


def _sin(perfil: Perfil, campo: str, neutro) -> Perfil:
    cambios = {campo: None if neutro == "sin_dato" else neutro}
    if campo == "edu" and neutro == "media":
        cambios["carrera_id"] = -1  # sin título no hay carrera
    return replace(perfil, **cambios)


@lru_cache(maxsize=256)
def _comparar(perfil: Perfil, duda: str, semilla: int, n: int) -> dict | None:
    """La comparación de la duda al empezar la partida; None si con este perfil la duda no queda pendiente."""
    try:
        p = partida.jugar(perfil, semilla, [], duda)
    except ValueError:
        return None
    if p.pendiente is None or p.pendiente.decision["id"] != duda:
        return None
    return partida.comparar_pendiente(p, semilla, n)


def _por_opcion(c: dict) -> dict[str, dict]:
    ganadores = c["ganador_por_mundo"]
    return {
        o["opcion"]: {"nombre": o["nombre"], "gana": ganadores.count(o["opcion"]) / len(ganadores),
                      "sueldo": o["sueldo"]["p50"]}
        for o in c["opciones"]
    }


@lru_cache(maxsize=64)
def peso_cv(perfil: Perfil, duda: str, semilla: int = 0, n: int = gemelos.N_GEMELOS) -> dict:
    """Para cada dato del CV distinto del neutro: la duda con ese dato y sin él, con los mismos dados.

    `gana` es la fracción de mundos donde esa opción termina ganando más; `sueldo`, el sueldo típico (p50).
    `mueve` dice qué cambia más: en cuántos mundos gana la opción clave o su sueldo típico.
    """
    con = _comparar(perfil, duda, semilla, n)
    if con is None:
        raise ValueError(f"la decisión {duda!r} no queda pendiente al empezar con este perfil")
    con_op = _por_opcion(con)
    datos, sin_efecto = [], []
    for campo in CAMPOS:
        neutro = _neutro(campo, perfil)
        if neutro is None:
            continue
        sin = _comparar(_sin(perfil, campo, neutro), duda, semilla, n)
        if sin is None:  # sin ese dato la duda ni aparece: no se puede comparar mundo a mundo
            continue
        sin_op = _por_opcion(sin)
        opciones = [
            {"opcion": o, "nombre": a["nombre"], "gana_con": a["gana"], "gana_sin": sin_op[o]["gana"],
             "sueldo_con": a["sueldo"], "sueldo_sin": sin_op[o]["sueldo"]}
            for o, a in con_op.items() if o in sin_op
        ]
        d_gana = {x["opcion"]: abs(x["gana_con"] - x["gana_sin"]) for x in opciones}
        d_sueldo = {x["opcion"]: abs(x["sueldo_con"] - x["sueldo_sin"]) / max(x["sueldo_con"], 1) for x in opciones}
        cambio = max(d_gana.values(), default=0) + max(d_sueldo.values(), default=0)
        if cambio < MIN_CAMBIO:
            sin_efecto.append(campo)
            continue
        mueve = "gana" if max(d_gana.values()) >= min(GANA_VISIBLE, max(d_sueldo.values())) else "sueldo"
        medida = d_gana if mueve == "gana" else d_sueldo
        # la opción clave: la que más cambia; entre iguales, la que no es la base (la que se está pensando)
        clave = max(opciones, key=lambda x: (medida[x["opcion"]], x["opcion"] != con["base"]))["opcion"]
        tuyo = getattr(perfil, campo)
        datos.append({"campo": campo, "tuyo": tuyo, "neutro": None if neutro == "sin_dato" else neutro,
                      "mueve": mueve, "opcion": clave, "cambio": round(cambio, 4), "opciones": opciones})
    datos.sort(key=lambda d: d["cambio"], reverse=True)
    return {"decision": duda, "nombre": con["nombre"], "pregunta": con["pregunta"], "gemelos": n, "semilla": semilla,
            "base": con["base"], "datos": datos[:MAX_DATOS], "sin_efecto": sin_efecto,
            "otros": [d["campo"] for d in datos[MAX_DATOS:]]}  # mueven algo, pero menos que los que se muestran

