"""Casos de uso del juego: crear el gemelo, avanzar una partida y comparar dos caminos.

Las frases del resultado salen de plantillas con números del motor: nunca lo contradicen.
"""

from __future__ import annotations

from fastapi import HTTPException

from app.repositories.simulations import SimulationRepository
from app.schemas.juego import CaminosIn, ComparacionIn, GemeloIn, Identidad, Perfil, Prioridades, SuerteIn, TurnoIn
from app.services.claude_service import ClaudeService, persona, politica_valida
from app.sim.catalogo import Catalogo, cargar_juego, cargar_mundos, catalogo, ids_mundos
from app.sim.gemelo import estado_inicial
from app.sim.indicadores import NOMBRES, indicadores
from app.sim.montecarlo import comparar_en_mundo, percentil_en, reproducir, vida_automatica
from app.sim.motor import _NULO, Alternativa, Pregunta, Vida
from app.sim.paquete import ErrorExpresion, paquete_base

ETIQUETAS = {"dinero": "Dinero", "carrera": "Carrera", "bienestar": "Bienestar", "vida_personal": "Vida personal"}
MUNDO_BASE = "estable_parecido"


def _clp(x: float) -> str:
    return "$" + f"{x:,.0f}".replace(",", ".")


def _pct1(p: float) -> str:
    return f"{p * 100:.1f}".replace(".", ",") + "%"


def _fuente(fid: str) -> dict:
    f = paquete_base().fuentes.get(fid)
    if f is None:
        return {"id": fid, "cita": "Supuesto del equipo" if fid == "equipo" else fid, "url": None, "pais": None, "verificacion": None}
    return {"id": fid, "cita": f["cita"], "url": f.get("url"), "pais": f.get("pais"), "verificacion": f.get("verificacion")}


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


def _alternativa(vida: Vida, pregunta_id: str, alt: Alternativa) -> dict:
    e = vida.e
    previo = {k: e.get(k) for k in (alt.eleccion or {})}
    e.update(alt.eleccion or {})
    try:
        probs = vida.probabilidades(pregunta_id, alt.opcion.resultados)
    finally:
        e.update(previo)
    return {
        "id": alt.id,
        "nombre": alt.nombre,
        "detalle": alt.opcion.detalle,
        "calidad": alt.opcion.calidad,
        "fuentes": [_fuente(f) for f in alt.opcion.fuentes],
        "resultados": [{"id": r.id, "texto": r.texto_al_ocurrir or r.texto, "tono": r.tono, "prob": round(p, 4)} for r, p in zip(alt.opcion.resultados, probs)],
        "efectos": vida.vista_previa(pregunta_id, alt),
        "arte": _arte_alternativa(pregunta_id, alt),
        "oferta": alt.oferta,
        "decision": alt.decision.id if alt.decision else None,
    }


def _pregunta(vida: Vida, q: Pregunta) -> dict:
    d = q.decision
    return {
        "anio": q.anio,
        "edad": vida.e["edad"],
        "origen": q.origen,
        "decision": {
            "id": d.id, "nombre": d.nombre, "pregunta": d.pregunta, "categoria": d.categoria, "calidad": d.calidad,
            "creencia_vs_dato": d.creencia_vs_dato,
            "evidencia": [{"cifra": ev["cifra"], "uso": ev.get("uso"), "fuente": _fuente(ev["fuente"])} for ev in d.evidencia],
        },
        "opciones": [_alternativa(vida, d.id, a) for a in q.alternativas],
        "eventos_previos": [x for x in vida._bitacora if not x["silencioso"]],
        "recesion": bool(vida.e["recesion"]),
        "situacion": {"estado": vida.e["estado"], "empleador": (vida.empleador or {}).get("nombre"), "tipo_empleador": vida.e["tipo_empleador"],
                      "rubro": vida.e["rubro"], "nivel": vida.e["seniority"], "sueldo": round(vida.e["sueldo"])},
        "contexto": _CONTEXTO.get(d.id) and vida.empresa(_CONTEXTO[d.id]),
    }


# Dibujo de cada opción (ver shared/ui/illustrations/DecisionArt.tsx en el front).
_ARTE = {
    "emigrar": "viaje", "sabatico": "viaje", "remoto_para_afuera": "viaje", "volver_a_chile": "viaje",
    "oferta_externa": "edificio", "buscar_estando_empleado": "edificio", "cambiar_de_rubro": "edificio", "jefatura": "edificio",
    "trabajar_mas_horas": "noche", "licencia_salud_mental": "noche", "renunciar": "puerta", "cesantia": "puerta",
    "unirse_a_startup": "cohete", "emprender": "cohete", "seguir_con_tu_empresa": "cohete",
    "magister": "estudiar", "bootcamp": "estudiar", "volver_a_estudiar": "estudiar", "aprender_ia": "estudiar",
    "ahorro": "invertir", "comprar_vivienda": "casa", "pedir_aumento": "invertir", "invertir_en_red": "gente",
    "tener_hijo": "casa", "formalizar_pareja": "gente", "separarse": "gente", "buscar_pareja": "gente",
    "pedir_hibrido": "casa", "media_jornada": "casa",
}
# Opciones de "no cambiar nada": dibujo de quedarse.
_QUEDARSE = {"quedarse", "no", "esperar", "aguantar", "rechazar", "seguir_igual", "arrendar", "normal", "ignorar", "intentar"}


_ARTE_OFERTA = {"startup": "cohete", "extranjero": "viaje", "publico": "edificio", "grande": "edificio", "pyme": "edificio"}


def _arte_alternativa(pregunta_id: str, alt: Alternativa) -> str:
    if alt.oferta:
        return _ARTE_OFERTA.get(alt.oferta["tipo"], "edificio")
    if alt.id == "quedarse":
        return "quedarse"
    return arte(alt.decision.id if alt.decision else pregunta_id, alt.opcion.id)


def arte(decision_id: str, opcion_id: str) -> str:
    if opcion_id in _QUEDARSE or (decision_id != "trabajar_mas_horas" and opcion_id == "no"):
        return "quedarse"
    return _ARTE.get(decision_id, "edificio")


# Decisiones cuya carta puede nombrar a un empleador o una vacante real (ver sim/empresas.py).
_CONTEXTO = {"unirse_a_startup": "startup", "remoto_para_afuera": "extranjero"}


def _empleador_inicial(perfil: Perfil, identidad: Identidad) -> dict | None:
    if perfil.estado != "empleado" or not identidad.empresa:
        return None
    return {"tipo": perfil.tipo_empleador, "nombre": identidad.empresa, "detalle": "el empleador que la persona declaró", "fuente": "Tu CV"}


def _instantanea(cat: Catalogo, e: dict) -> dict:
    return {
        "edad": e["edad"], "estado": e["estado"], "tipo_empleador": e["tipo_empleador"], "rubro": e["rubro"], "nivel": e["nivel"],
        "seniority": e["seniority"], "sueldo": e["sueldo"], "sueldo_ref": e["sueldo_ref"], "ahorro": e["ahorro"], "edu": e["edu"],
        "pareja": e["pareja"], "hijos": e["hijos"], "percentil": e["percentil"] if e["sueldo"] > 0 else None,
        "usa_ia": bool(e["usa_ia"]), "exposicion_ia": e["exposicion_ia"], "indicadores": indicadores(cat, e),
    }


def _nombres_opciones(vida: Vida, decision_id: str) -> dict[str, str]:
    return {a.id: a.nombre for a in vida.alternativas(vida.cat.decisiones[decision_id])}


def bifurcaciones_disponibles(cat: Catalogo, estado: dict, prioridades: dict) -> list[dict]:
    vida = Vida(cat, estado, prioridades, 0)
    out = []
    for b in cat.juego["bifurcaciones"]:
        dec = cat.decisiones[b["decision"]]
        if not dec.cuando(vida.e, _NULO):
            continue
        alts = {a.id: a for a in vida.alternativas(dec)}
        if b["a"] not in alts or b["b"] not in alts:
            continue
        out.append({
            "id": b["id"], "titulo": b["titulo"], "premisa": b["premisa"], "decision": dec.id, "categoria": dec.categoria,
            "calidad": dec.calidad, "creencia_vs_dato": dec.creencia_vs_dato,
            "a": _alternativa(vida, dec.id, alts[b["a"]]),
            "b": _alternativa(vida, dec.id, alts[b["b"]]),
        })
    return out


def _gente_como_tu(cat: Catalogo, e: dict) -> list[dict]:
    """Lo que le pasa normalmente a alguien con este perfil, con la fuente de cada número."""
    pq = cat.paquete
    ev = cat.evento_por_id
    q = pq.cuantiles_esi(e["edu"], e["banda7"])
    filas = []

    def fila(titulo, valor, unidad, detalle, calidad, fuentes):
        filas.append({"titulo": titulo, "valor": valor, "unidad": unidad, "detalle": detalle, "calidad": calidad, "fuentes": [_fuente(f) for f in fuentes]})

    sueldo = e["sueldo"] or e["sueldo_ref"]
    pct = pq.percentil({**e, "sueldo": sueldo})
    fila("Tu sueldo frente a gente de tu edad y estudios", pct, "percentil",
         f"Entre personas de {e['banda7']} años con educación {e['edu']}: el 10% gana menos de {_clp(q[0])}, la mitad menos de {_clp(q[2])} y el 10% más alto sobre {_clp(q[4])}.",
         "dato", ["ine_esi_2025"])
    fila("Cuánto sube el sueldo de alguien como tú", e["crecimiento_esi"], "fraccion_anual",
         "Alza real por año que separa la mediana de tu tramo de edad de la del siguiente.", "dato", ["ine_esi_2025"])
    if e["estado"] == "empleado":
        sep = ev["separacion_empleo"]
        if sep.cuando(e, _NULO):
            fila("Riesgo de perder la pega este año", sep.prob_anual(e, _NULO), "probabilidad",
                 f"Despido o fin de contrato para tu edad ({_pct1(pq.k('P_SEPARACION', e['banda3']))}), ajustado por tipo de empleador ({e['tipo_empleador']}) y rubro ({e['rubro']}).",
                 sep.calidad, sep.fuentes)
        of = ev["oferta_llega"]
        fila("Probabilidad de que te llegue una oferta sin buscarla", min(1.0, of.prob_anual(e, _NULO)), "probabilidad",
             "Parte de cuánta gente de tu edad cambia de empleador sin pasar por la cesantía; sube con tu red de contactos.", of.calidad, of.fuentes)
        if e["prob_ascenso"] > 0:
            fila("Probabilidad de ascenso este año", e["prob_ascenso"], "probabilidad",
                 "Baja a medida que subes de nivel. Es un supuesto del equipo inspirado en estudios de carreras dentro de una empresa.", "supuesto", ["baker_gibbs_1994"])
    fila("Si quedas sin pega, cuánto dura la búsqueda", pq.k("MESES_CESANTIA", e["banda3"]), "meses",
         "Duración media para tu tramo de edad; en recesión se alarga.", "dato", ["eps_2024"])
    expuesta = e["exposicion_ia"] >= pq.k("IA_EXPUESTA")
    fila("Exposición de tu área a la IA", e["exposicion_ia"], "puntaje",
         ("Tu área cuenta como expuesta" if expuesta else "Tu área cuenta como poco expuesta") + f" (umbral {str(pq.k('IA_EXPUESTA')).replace('.', ',')}). En los mundos con revolución digital esto pesa si no aprendes a usarla.",
         "mixto", ["microsoft_ia"])
    return filas


class JuegoService:
    def __init__(self, repo: SimulationRepository, n_por_defecto: int):
        self.repo = repo
        self.n_por_defecto = n_por_defecto

    # ------------------------------------------------------------------ gemelo
    def crear_gemelo(self, body: GemeloIn) -> dict:
        cat = catalogo(MUNDO_BASE)
        pr = _prioridades(body.prioridades)
        e = Vida(cat, _estado(cat, body.perfil), pr, 0).e  # la vida agrega las derivadas del motor (prob_ascenso)
        return {
            "perfil": body.perfil.model_dump(),
            "prioridades": pr,
            "estado": _instantanea(cat, e),
            "gente_como_tu": _gente_como_tu(cat, e),
            "bifurcaciones": bifurcaciones_disponibles(cat, e, pr),
            "mundos": [{k: m[k] for k in ("id", "nombre", "descripcion", "ciclo", "tecnologia")} for m in cargar_mundos()["mundos"]],
            "horizonte_anios": cat.juego["horizonte_anios"],
        }

    # ------------------------------------------------------------------ caminos
    def caminos(self, body: CaminosIn, claude: ClaudeService) -> dict:
        """La primera pantalla: cada bifurcación posible como una carta (su opción A); la B queda como el camino de comparación."""
        cat = catalogo(MUNDO_BASE)
        pr = _prioridades(body.prioridades)
        vida = Vida(cat, _estado(cat, body.perfil), pr, body.semilla, empleador=_empleador_inicial(body.perfil, body.identidad))
        cartas = []
        for b in bifurcaciones_disponibles(cat, vida.e, pr):
            tipo = _CONTEXTO.get(b["decision"])
            cartas.append({**b, "contexto": vida.empresa(tipo) if tipo else None})
        e = vida.e
        titulo_base = (
            f"{e['antiguedad']} años en {(vida.empleador or {}).get('nombre') or 'tu pega'}. ¿Y ahora?" if e["estado"] == "empleado" and e["antiguedad"]
            else "Llevas meses buscando. ¿Y ahora?" if e["estado"] == "buscando" else "¿Y ahora?"
        )
        orden = [c["id"] for c in cartas]
        narrado = claude.caminos(
            persona(body),
            [{"id": c["id"], "camino": c["a"]["nombre"], "pregunta": c["titulo"], "detalle": c["a"]["detalle"], "contexto_real": c["contexto"]} for c in cartas],
        )
        if narrado:
            orden = [x.id for x in narrado.elegidos] + [i for i in orden if i not in {x.id for x in narrado.elegidos}]
            textos = {x.id: {"titulo": x.titulo, "texto": x.texto} for x in narrado.elegidos}
        else:
            textos = {}
        por_id = {c["id"]: c for c in cartas}
        return {
            "titulo": narrado.titulo if narrado else titulo_base,
            "total": len(cartas),
            "por_claude": narrado is not None,
            "caminos": [{**por_id[i], "narrado": textos.get(i)} for i in orden[:4]],
            "indicadores": indicadores(cat, e),
            "edad": e["edad"],
        }

    # ------------------------------------------------------------------ partida
    def _bifurcacion(self, bid: str | None) -> dict | None:
        if bid is None:
            return None
        b = next((x for x in cargar_juego()["bifurcaciones"] if x["id"] == bid), None)
        if b is None:
            raise HTTPException(422, f"Bifurcación desconocida: {bid}")
        return b

    def _catalogo(self, mundo: str) -> Catalogo:
        if mundo not in ids_mundos():
            raise HTTPException(422, f"Mundo desconocido: {mundo}")
        return catalogo(mundo)

    def turno(self, body: TurnoIn) -> dict:
        cat = self._catalogo(body.mundo)
        bif = self._bifurcacion(body.bifurcacion)
        if bif and body.elecciones and body.elecciones[0] not in (bif["a"], bif["b"]):
            raise HTTPException(422, f"La primera elección debe ser {bif['a']} o {bif['b']}.")
        estado = _estado(cat, body.perfil)
        pr = _prioridades(body.prioridades)
        anios = cat.juego["horizonte_anios"]
        if bif and bif["id"] not in {b["id"] for b in bifurcaciones_disponibles(cat, estado, pr)}:
            raise HTTPException(422, "Esa bifurcación no aplica a tu situación actual.")
        try:
            vida, pendiente = reproducir(cat, estado, pr, body.semilla, anios, body.elecciones, bif["decision"] if bif else None,
                                         empleador=_empleador_inicial(body.perfil, body.identidad), politica=politica_valida(body.identidad),
                                         cargo=body.identidad.cargo)
        except ValueError as x:
            raise HTTPException(422, str(x)) from x
        out = {
            "terminada": pendiente is None,
            "empleador": vida.empleador if vida.e["estado"] == "empleado" else None,
            "anios": vida.anios,
            "horizonte_anios": anios,
            "estado": _instantanea(cat, vida.e),
            "pendiente": _pregunta(vida, pendiente) if pendiente else None,
            "mundo": {"id": cat.mundo.id, "nombre": cat.mundo.nombre},
        }
        if pendiente is None:
            out["resumen"] = self._resumen_partida(vida)
        return out

    @staticmethod
    def _resumen_partida(vida: Vida) -> dict:
        n = len(vida.anios)
        return {
            "felicidad": vida.felicidad(),
            "indicadores": {k: sum(a["indicadores"][k] for a in vida.anios) / n for k in NOMBRES},
            "ingreso_acumulado": sum(12 * a["sueldo"] for a in vida.anios),
            "sueldo_final": vida.anios[-1]["sueldo"],
            "ahorro_final": vida.anios[-1]["ahorro"],
            "anios_sin_ingreso": sum(1 for a in vida.anios if a["sueldo"] <= 0),
            "recesiones": sum(1 for a in vida.anios if a["recesion"]),
        }

    # ------------------------------------------------------------------ suerte
    def suerte(self, body: "SuerteIn") -> dict:
        """Dónde quedó tu carrera entre muchas vidas tuyas: mismo punto de partida, mismo mundo, decidiendo como tú."""
        import numpy as np

        cat = self._catalogo(body.mundo)
        pr = _prioridades(body.prioridades)
        estado = _estado(cat, body.perfil)
        politica = politica_valida(body.identidad)
        anios = cat.juego["horizonte_anios"]
        n = body.n or self.n_por_defecto
        vidas = [vida_automatica(cat, estado, pr, body.semilla, i + 1, anios, politica=politica) for i in range(n)]
        fel = np.sort([v.felicidad() for v in vidas])
        sueldo = np.sort([v.anios[-1]["sueldo"] for v in vidas])
        ingreso = np.sort([sum(12 * a["sueldo"] for a in v.anios) for v in vidas])
        sin_pega = np.array([sum(1 for a in v.anios if a["sueldo"] <= 0) for v in vidas])
        return {
            "n": n,
            "percentil_felicidad": percentil_en(fel, body.felicidad),
            "percentil_sueldo": percentil_en(sueldo, body.sueldo_final),
            "percentil_ingreso": percentil_en(ingreso, body.ingreso_acumulado),
            "felicidad": {"p10": float(np.percentile(fel, 10)), "p50": float(np.percentile(fel, 50)), "p90": float(np.percentile(fel, 90))},
            "sueldo_final": {"p10": float(np.percentile(sueldo, 10)), "p50": float(np.percentile(sueldo, 50)), "p90": float(np.percentile(sueldo, 90))},
            "prob_sin_pega": float((sin_pega > 0).mean()),
            "muestra_felicidad": [round(float(x), 1) for x in fel[np.linspace(0, n - 1, min(n, 60)).astype(int)]],
        }

    # ------------------------------------------------------------------ comparación
    def comparar(self, body: ComparacionIn) -> dict:
        bif = self._bifurcacion(body.bifurcacion)
        n = body.n or self.n_por_defecto
        pr = _prioridades(body.prioridades)
        base = catalogo(MUNDO_BASE)
        estado_base = _estado(base, body.perfil)
        disponibles = {b["id"]: b for b in bifurcaciones_disponibles(base, estado_base, pr)}
        if bif["id"] not in disponibles:
            raise HTTPException(422, "Esa bifurcación no aplica a tu situación actual.")
        nombre_a, nombre_b = disponibles[bif["id"]]["a"]["nombre"], disponibles[bif["id"]]["b"]["nombre"]
        anios = base.juego["horizonte_anios"]

        politica = politica_valida(body.identidad)
        celdas, orden = [], {}
        for mid in ids_mundos():
            cat = catalogo(mid)
            celda = comparar_en_mundo(cat, _estado(cat, body.perfil), pr, bif["decision"], bif["a"], bif["b"], n, body.semilla, anios, politica)
            orden[mid] = (celda.pop("_felicidad_a"), celda.pop("_felicidad_b"))
            p, m = celda["prob_gana_a"], celda["margen"]
            celda["gana"] = "a" if p - m > 0.5 else "b" if p + m < 0.5 else "parejo"
            celdas.append(celda)

        partidas = []
        for jugada in body.partidas:
            cat = self._catalogo(jugada.mundo)
            if not jugada.elecciones or jugada.elecciones[0] not in (bif["a"], bif["b"]):
                raise HTTPException(422, "Cada partida debe partir por una de las dos opciones de la bifurcación.")
            try:
                vida, pendiente = reproducir(cat, _estado(cat, body.perfil), pr, jugada.semilla, anios, jugada.elecciones, bif["decision"],
                                             empleador=_empleador_inicial(body.perfil, body.identidad), politica=politica)
            except ValueError as x:
                raise HTTPException(422, str(x)) from x
            if pendiente is not None:
                raise HTTPException(422, "Hay una partida sin terminar.")
            camino = "a" if jugada.elecciones[0] == bif["a"] else "b"
            fel = vida.felicidad()
            partidas.append({
                "mundo": jugada.mundo, "camino": camino, "felicidad": fel,
                "percentil": percentil_en(orden[jugada.mundo][0 if camino == "a" else 1], fel),
                **{k: v for k, v in self._resumen_partida(vida).items() if k != "felicidad"},
            })

        resultado = {
            "bifurcacion": {"id": bif["id"], "titulo": bif["titulo"], "decision": bif["decision"], "a": {"id": bif["a"], "nombre": nombre_a}, "b": {"id": bif["b"], "nombre": nombre_b}},
            "prioridades": pr,
            "politica_propia": politica is not None,
            "n": n,
            "horizonte_anios": anios,
            "semilla": body.semilla,
            "mundos": celdas,
            "partidas": partidas,
            "veredicto": _veredicto(celdas, nombre_a, nombre_b),
            "aprendizajes": _aprendizajes(celdas, nombre_a, nombre_b, body.partidas[0].mundo if body.partidas else MUNDO_BASE),
        }
        resultado["id"] = self.repo.save(body.model_dump(), resultado)
        return resultado

    def obtener_comparacion(self, cid: str) -> dict | None:
        fila = self.repo.get(cid)
        return {**fila["result"], "id": fila["id"]} if fila else None


# ---------------------------------------------------------------------- frases (plantillas)
def _lista(nombres: list[str]) -> str:
    return nombres[0] if len(nombres) == 1 else ", ".join(nombres[:-1]) + " y " + nombres[-1]


def _pct(p: float) -> str:
    return f"{round(p * 100)}%"


def _veredicto(celdas: list[dict], a: str, b: str) -> dict:
    gana_a = [c["mundo"]["nombre"] for c in celdas if c["gana"] == "a"]
    gana_b = [c["mundo"]["nombre"] for c in celdas if c["gana"] == "b"]
    total = len(celdas)
    if gana_a and gana_b:
        tipo, camino = "apuesta", None
        frase = f"Depende del mundo que venga: «{a}» gana en {_lista(gana_a).lower()}; «{b}», en {_lista(gana_b).lower()}."
    elif not gana_a and not gana_b:
        tipo, camino = "empate", None
        frase = f"Con tus prioridades, ningún camino saca una ventaja clara en ninguno de los {total} mundos: la diferencia es menor que el margen de error."
    else:
        camino, ganador, mundos = ("a", a, gana_a) if gana_a else ("b", b, gana_b)
        if len(mundos) == total:
            tipo, frase = "robusta", f"«{ganador}» es la opción robusta: te deja mejor en los {total} mundos."
        elif len(mundos) >= total / 2:
            tipo, frase = "favorable", f"«{ganador}» te deja mejor en {len(mundos)} de los {total} mundos y empata en el resto."
        else:
            tipo, frase = "leve", f"«{ganador}» saca ventaja solo en {_lista(mundos).lower()}; en el resto de los mundos los dos caminos empatan."
    return {"tipo": tipo, "camino": camino, "mundos_gana_a": len(gana_a), "mundos_gana_b": len(gana_b), "frase": frase}


def _aprendizajes(celdas: list[dict], a: str, b: str, mundo_foco: str) -> list[dict]:
    foco = next((c for c in celdas if c["mundo"]["id"] == mundo_foco), celdas[0])
    nombre_foco = foco["mundo"]["nombre"].lower()
    out = []

    por = foco["prob_gana_a_por_indicador"]
    mejor, peor = max(por, key=por.get), min(por, key=por.get)
    if por[mejor] >= 0.55 and por[peor] <= 0.45:
        out.append({
            "tipo": "trade_off",
            "frase": f"El trade-off: «{a}» te deja mejor en {ETIQUETAS[mejor]} en {_pct(por[mejor])} de los futuros, y «{b}» te deja mejor en {ETIQUETAS[peor]} en {_pct(1 - por[peor])} (mundo {nombre_foco}). Qué camino gana depende de cuánto pesa cada cosa para ti.",
        })

    f = foco["factor_decisivo"]
    if f and abs(f["prob_a_con"] - f["prob_a_sin"]) >= 0.10:
        donde = "" if f["camino"] is None else f" en el camino «{a if f['camino'] == 'a' else b}»"
        out.append({
            "tipo": "factor_decisivo",
            "frase": f"De qué depende: cuando {f['texto']}{donde} (pasa en {_pct(f['frecuencia'])} de los futuros), «{a}» gana en {_pct(f['prob_a_con'])}; cuando no, en {_pct(f['prob_a_sin'])}.",
        })

    pa, pb = foco["a"]["felicidad"], foco["b"]["felicidad"]
    ancho_a, ancho_b = pa["p90"] - pa["p10"], pb["p90"] - pb["p10"]
    if abs(ancho_a - ancho_b) >= 1.5:
        arriesgado, seguro = (a, b) if ancho_a > ancho_b else (b, a)
        peor_a, peor_b = round(pa["p10"]), round(pb["p10"])
        out.append({
            "tipo": "riesgo",
            "frase": f"El riesgo: «{arriesgado}» abre más el abanico que «{seguro}». En el 10% de los futuros que salen peor terminas con felicidad {peor_a} en «{a}» y {peor_b} en «{b}».",
        })

    def promedio(eje: str, valor: str) -> float:
        xs = [c["prob_gana_a"] for c in celdas if c["mundo"][eje] == valor]
        return sum(xs) / len(xs)

    d_ciclo = promedio("ciclo", "volatil") - promedio("ciclo", "estable")
    d_tec = promedio("tecnologia", "digital") - promedio("tecnologia", "parecido")
    if max(abs(d_ciclo), abs(d_tec)) >= 0.05:
        if abs(d_ciclo) >= abs(d_tec):
            out.append({"tipo": "mundo", "frase": f"Lo que más mueve el resultado es el ciclo económico: «{a}» gana en {_pct(promedio('ciclo', 'estable'))} de los futuros en mundos estables y en {_pct(promedio('ciclo', 'volatil'))} en mundos volátiles."})
        else:
            out.append({"tipo": "mundo", "frase": f"Lo que más mueve el resultado es la tecnología: «{a}» gana en {_pct(promedio('tecnologia', 'parecido'))} de los futuros si todo sigue parecido y en {_pct(promedio('tecnologia', 'digital'))} con revolución digital."})

    sa, sb = foco["a"]["prob_sin_pega"], foco["b"]["prob_sin_pega"]
    if abs(sa - sb) >= 0.05:
        out.append({"tipo": "cesantia", "frase": f"Pasas al menos un año sin ingresos en {_pct(sa)} de los futuros de «{a}» y en {_pct(sb)} de los de «{b}»."})
    return out
