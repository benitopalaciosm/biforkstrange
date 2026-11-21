"""Claude con un LLM falso: se revisa qué se le manda, qué se acepta de vuelta y los respaldos."""

import json

from app.schemas.juego import (
    AnioNarrado, CasoNarrado, EpilogoIn, EpilogoOut, GemeloLeido, HistoriaIn, HistoriaOut, Identidad, OpcionNarrada, Perfil,
    PerfilLeido, PrioridadesLeidas, Propension,
)
from app.services.claude_service import ClaudeService, politica_valida
from app.sim.catalogo import catalogo
from app.sim.gemelo import estado_inicial


class _LLM:
    nombre = "falso"

    def __init__(self, respuesta):
        self.respuesta, self.llamadas = respuesta, []

    def pedir(self, **kw):
        self.llamadas.append(kw)
        return self.respuesta


def test_leer_gemelo_descarta_lo_que_no_existe_en_el_motor():
    leido = GemeloLeido(
        perfil=PerfilLeido(edad=31, edu="universitaria", rubro="Criptomonedas", area="Tecnología", nivel=9),
        gemelo_md="Eres analista.", rasgos=["Aprende rápido", " ", "x" * 80], prioridades=PrioridadesLeidas(dinero=20, carrera=40, bienestar=20, vida_personal=20), riesgo=9,
        politica=[Propension(decision="jefatura", opcion="aceptar", prob=0.2), Propension(decision="jefatura", opcion="rechazar", prob=0.6),
                  Propension(decision="volar", opcion="si", prob=1), Propension(decision="sabatico", opcion="irse", prob=0.5)],
    )
    llm = _LLM(leido)
    out = ClaudeService(llm).leer_gemelo(b"%PDF-1.7", True, "Me aburro rápido.")
    llamada = llm.llamadas[0]
    assert llamada["pdf"] == b"%PDF-1.7" and "Me aburro rápido." in llamada["usuario"]
    assert "Finanzas y seguros" in llamada["sistema"] and '"decision": "oferta_externa"' in llamada["sistema"]
    assert out.perfil.rubro is None and out.perfil.nivel is None and out.perfil.area == "Tecnología" and out.riesgo == 5
    assert len(out.rasgos) == 2 and len(out.rasgos[1]) == 40
    # Queda solo la decisión completa y válida, renormalizada; la incompleta y la inventada se van.
    assert {(p.decision, p.opcion): p.prob for p in out.politica} == {("jefatura", "aceptar"): 0.25, ("jefatura", "rechazar"): 0.75}


def test_la_politica_del_gemelo_cambia_como_deciden_los_que_juegan_solos(perfil):
    cat = catalogo("estable_parecido")
    e = estado_inicial(cat, {**perfil, "riesgo": 50})
    ops = {o.id for o in cat.decisiones["oferta_externa"].opciones}
    siempre = politica_valida(Identidad(politica=[Propension(decision="oferta_externa", opcion=o, prob=1 if o == "cambiar" else 0) for o in ops]))
    nunca = politica_valida(Identidad(politica=[Propension(decision="oferta_externa", opcion=o, prob=1 if o == "quedarse" else 0) for o in ops]))
    pr = {"dinero": 1}

    def cambios(politica):
        from app.sim.montecarlo import vida_automatica

        return sum("oferta_externa/mejora" in v.hechos or "oferta_externa/igual_o_peor" in v.hechos
                   for v in (vida_automatica(cat, e, pr, 3, i, 10, politica=politica) for i in range(80)))

    assert cambios(siempre) > cambios(None) > cambios(nunca)


def test_historia_solo_acepta_la_carta_si_trae_las_opciones_del_motor(perfil):
    pendiente = {"decision": {"pregunta": "¿Te cambias?"}, "opciones": [{"id": "cambiar", "nombre": "Cambiarte", "resultados": []}, {"id": "quedarse", "nombre": "Quedarte", "resultados": []}],
                 "contexto": {"nombre": "Fintual"}, "eventos_previos": []}
    anio = {"t": 0, "edad": 27, "estado": "empleado", "sueldo": 1_900_000, "sueldo_inicio": 1_800_000, "eventos": [
        {"id": "ascenso", "nombre": "Ascenso", "texto": "Te ascienden.", "tono": "bueno", "silencioso": False},
        {"id": "alza_anual", "nombre": "Alza", "texto": "x", "silencioso": True}]}
    body = HistoriaIn(perfil=Perfil(**perfil), identidad=Identidad(gemelo_md="Eres curiosa."), anio=anio, pendiente=pendiente, historia_previa=["2027: entraste."])

    buena = HistoriaOut(
        anio=AnioNarrado(titulo="El ascenso.", relato="Te ascendieron.", momento=["a", "b", "c"]),
        caso=CasoNarrado(titulo="Fintual te llama. ¿Vas?", opciones=[OpcionNarrada(id="quedarse", titulo="Seguir", texto="Sigues."), OpcionNarrada(id="cambiar", titulo="Ir", texto="Te vas.")]),
    )
    llm = _LLM(buena)
    out = ClaudeService(llm).historia(body)
    assert out.caso is not None and out.anio.relato == "Te ascendieron."
    # El año no traía un momento duro: esas frases se descartan.
    assert out.anio.momento == []
    enviado = json.loads(llm.llamadas[0]["usuario"])
    assert enviado["persona"]["quien_es"] == "Eres curiosa." and enviado["pendiente"]["contexto_real"] == {"nombre": "Fintual"}
    assert [x["que"] for x in enviado["anio"]["eventos"]] == ["Ascenso"]

    inventa = HistoriaOut(caso=CasoNarrado(titulo="x", opciones=[OpcionNarrada(id="cambiar", titulo="a", texto="a"), OpcionNarrada(id="emigrar", titulo="b", texto="b")]))
    assert ClaudeService(_LLM(inventa)).historia(body).caso is None
    assert ClaudeService(_LLM(None)).historia(body) is None
    assert ClaudeService(None).historia(body) is None


def test_epilogo_y_respaldo(perfil):
    body = EpilogoIn(perfil=Perfil(**perfil), camino="Irte a la startup", historia=["2027: entraste."], resumen={"felicidad": 70}, anio_final=2036)
    ep = EpilogoOut(titulo="Diez años.", historia="Partiste.", cv=["2036: Senior"], lo_que_te_llevas="Dependió de un año.")
    assert ClaudeService(_LLM(ep)).epilogo(body) == ep
    assert ClaudeService(None).epilogo(body) is None
