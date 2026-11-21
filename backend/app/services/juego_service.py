"""Casos de uso del juego: validar el gemelo, jugar una temporada y medir tu suerte al final."""

from __future__ import annotations

import numpy as np
from fastapi import HTTPException

from app.schemas.juego import Identidad, Perfil, Prioridades, SuerteIn, TurnoIn
from app.services.claude_service import politica_valida
from app.sim.catalogo import Catalogo, cargar_juego, cargar_mundos, catalogo, ids_mundos
from app.sim.gemelo import estado_inicial
from app.sim.indicadores import NOMBRES, indicadores
from app.sim.montecarlo import percentil_en, reproducir, vida_automatica
from app.sim.motor import QUEDARSE, Alternativa, Pregunta, Vida
from app.sim.paquete import ErrorExpresion, paquete_base

MUNDO_BASE = "estable_parecido"

# Dibujo de cada opción (ver shared/ui/illustrations/DecisionArt.tsx en el front).
_ARTE = {
    "emigrar": "viaje", "sabatico": "viaje", "volver_a_chile": "viaje", "jefatura": "edificio",
    "trabajar_mas_horas": "noche", "licencia_salud_mental": "noche", "renunciar": "puerta", "cesantia": "puerta",
    "emprender": "cohete", "seguir_con_tu_empresa": "cohete",
    "magister": "estudiar", "bootcamp": "estudiar", "volver_a_estudiar": "estudiar", "aprender_ia": "estudiar",
    "ahorro": "invertir", "pedir_aumento": "invertir", "comprar_vivienda": "casa", "tener_hijo": "casa",
    "pedir_hibrido": "casa", "media_jornada": "casa", "invertir_en_red": "gente", "formalizar_pareja": "gente",
    "separarse": "gente", "buscar_pareja": "gente",
}
_ARTE_OFERTA = {"startup": "cohete", "extranjero": "viaje"}


def perfil_a_dict(perfil: Perfil) -> dict:
    """Traduce el perfil de la API a variables de estado.json."""
    pq = paquete_base()
    p = perfil.model_dump()
    if perfil.rubro and perfil.rubro not in pq.variables["rubro"]["dominio"]:
        raise HTTPException(422, f"Rubro desconocido: {perfil.rubro}")
    if perfil.area and perfil.area not in pq.variables["area"]["dominio"]:
        raise HTTPException(422, f"Área desconocida: {perfil.area}")
    for k in ("ingles", "usa_ia", "remoto", "isapre", "propietario"):
        p[k] = int(p[k])
    p["riesgo"] = (perfil.riesgo - 1) * 25
    if perfil.carrera_id is not None and perfil.edu != "media":
        fila = pq.filas("mifuturo_carreras")[perfil.carrera_id]
        p["area"], p["tipo_institucion"] = fila["area"], fila["tipo_institucion"]
    else:
        p["carrera_id"] = -1
    if perfil.tipo_empleador == "publico":
        p["rubro"] = "Administración pública"
    if perfil.estado == "buscando":
        p["sueldo_ref"], p["sueldo"], p["meses_cesante"] = perfil.sueldo, 0, 6
    return p


def _estado(cat: Catalogo, perfil: Perfil) -> dict:
    try:
        return estado_inicial(cat, perfil_a_dict(perfil))
    except ErrorExpresion as x:
        raise HTTPException(422, f"No hay datos para ese perfil: {x}") from x


def _prioridades(p: Prioridades) -> dict[str, float]:
    total = p.dinero + p.carrera + p.bienestar + p.vida_personal
    return {k: getattr(p, k) / total * 100 for k in NOMBRES}


def _catalogo(mundo: str) -> Catalogo:
    if mundo not in ids_mundos():
        raise HTTPException(422, f"Mundo desconocido: {mundo}")
    return catalogo(mundo)


def _arte(pregunta_id: str, alt: Alternativa) -> str:
    if alt.oferta:
        return _ARTE_OFERTA.get(alt.oferta["tipo"], "edificio")
    if alt.id == "quedarse" or alt.opcion.id in QUEDARSE:
        return "quedarse"
    return _ARTE.get(alt.decision.id if alt.decision else pregunta_id, "edificio")


def _pregunta(vida: Vida, q: Pregunta) -> dict:
    d = q.decision
    return {
        "anio": q.anio,
        "edad": vida.e["edad"],
        "origen": q.origen,
        "decision": {"id": d.id, "nombre": d.nombre, "pregunta": d.pregunta},
        "opciones": [
            {"id": a.id, "nombre": a.nombre, "detalle": a.opcion.detalle, "efectos": vida.vista_previa(d.id, a), "arte": _arte(d.id, a),
             "oferta": a.oferta, "decision": a.decision.id if a.decision else None}
            for a in q.alternativas
        ],
    }


def _empleador_inicial(perfil: Perfil, identidad: Identidad) -> dict | None:
    if perfil.estado != "empleado" or not identidad.empresa:
        return None
    return {"tipo": perfil.tipo_empleador, "nombre": identidad.empresa, "detalle": "el empleador que la persona declaró", "fuente": "Tu CV"}


def catalogo_formulario(claude: bool, transporte: str | None) -> dict:
    pq, juego = paquete_base(), cargar_juego()
    return {
        "rubros": [r for r in pq.variables["rubro"]["dominio"] if r and r != "Administración pública"],
        "areas": [a for a in pq.variables["area"]["dominio"] if a],
        "mundos": [{k: m[k] for k in ("id", "nombre", "descripcion", "ciclo", "tecnologia")} for m in cargar_mundos()["mundos"]],
        "horizonte_anios": juego["horizonte_anios"],
        "politica_base": {d: {o: v[0] for o, v in ops.items()} for d, ops in juego["politica"]["opciones"].items()},
        "claude": claude,
        "claude_transporte": transporte,
    }


class JuegoService:
    def __init__(self, n_por_defecto: int):
        self.n_por_defecto = n_por_defecto

    def validar_gemelo(self, perfil: Perfil, prioridades: Prioridades) -> dict:
        cat = catalogo(MUNDO_BASE)
        e = _estado(cat, perfil)
        _prioridades(prioridades)
        return {"edad": e["edad"], "indicadores": indicadores(cat, e)}

    def turno(self, body: TurnoIn) -> dict:
        """Recalcula la carrera con las elecciones dadas (es determinista) y devuelve la próxima temporada o el final."""
        cat = _catalogo(body.mundo)
        anios = cat.juego["horizonte_anios"]
        try:
            vida, pendiente = reproducir(cat, _estado(cat, body.perfil), _prioridades(body.prioridades), body.semilla, anios, body.elecciones,
                                         empleador=_empleador_inicial(body.perfil, body.identidad), politica=politica_valida(body.identidad),
                                         cargo=body.identidad.cargo)
        except ValueError as x:
            raise HTTPException(422, str(x)) from x
        e = vida.e
        out = {
            "terminada": pendiente is None,
            "empleador": vida.empleador if e["estado"] == "empleado" else None,
            "anios": vida.anios,
            "horizonte_anios": anios,
            "estado": {"edad": e["edad"], "estado": e["estado"], "sueldo": e["sueldo"], "indicadores": indicadores(cat, e)},
            "pendiente": _pregunta(vida, pendiente) if pendiente else None,
            "mundo": {"id": cat.mundo.id, "nombre": cat.mundo.nombre},
        }
        if pendiente is None:
            out["resumen"] = {
                "felicidad": vida.felicidad(),
                "ingreso_acumulado": sum(12 * a["sueldo"] for a in vida.anios),
                "sueldo_final": vida.anios[-1]["sueldo"],
                "ahorro_final": vida.anios[-1]["ahorro"],
                "anios_sin_ingreso": sum(1 for a in vida.anios if a["sueldo"] <= 0),
            }
        return out

    def suerte(self, body: SuerteIn) -> dict:
        """Dónde quedó tu carrera entre muchas vidas tuyas: mismo punto de partida, mismo mundo, decidiendo como tú."""
        cat = _catalogo(body.mundo)
        estado, pr, politica = _estado(cat, body.perfil), _prioridades(body.prioridades), politica_valida(body.identidad)
        n = body.n or self.n_por_defecto
        vidas = [vida_automatica(cat, estado, pr, body.semilla, i + 1, cat.juego["horizonte_anios"], politica=politica) for i in range(n)]
        fel = np.sort([v.felicidad() for v in vidas])
        sueldo = np.sort([v.anios[-1]["sueldo"] for v in vidas])
        ingreso = np.sort([sum(12 * a["sueldo"] for a in v.anios) for v in vidas])
        return {
            "n": n,
            "percentil_felicidad": percentil_en(fel, body.felicidad),
            "percentil_sueldo": percentil_en(sueldo, body.sueldo_final),
            "percentil_ingreso": percentil_en(ingreso, body.ingreso_acumulado),
            "felicidad": {q: float(np.percentile(fel, int(q[1:]))) for q in ("p10", "p50", "p90")},
            "sueldo_final": {q: float(np.percentile(sueldo, int(q[1:]))) for q in ("p10", "p50", "p90")},
        }
