from app.sim.catalogo import catalogo
from app.sim.gemelo import estado_inicial
from app.sim.montecarlo import reproducir, vida_automatica
from app.sim.motor import Vida

PR = {"dinero": 40, "vida_personal": 30, "carrera": 20, "bienestar": 10}


def _estado(cat, perfil, **extra):
    return estado_inicial(cat, {**perfil, "riesgo": 75, **extra})


def _firma(vida):
    return [(a["estado"], round(a["sueldo"]), round(a["ahorro"]), a["recesion"]) for a in vida.anios]


def _jugar(cat, e, semilla, primera=None):
    """Juega una carrera eligiendo `primera` en la temporada 1 (si existe) y luego siempre la última opción."""
    elecciones: list[str] = []
    vida, pendiente = reproducir(cat, e, PR, semilla, 10, elecciones)
    while pendiente is not None:
        ids = [a.id for a in pendiente.alternativas]
        elecciones.append(primera if not elecciones and primera in ids else ids[-1])
        vida, pendiente = reproducir(cat, e, PR, semilla, 10, elecciones)
    return vida, elecciones


def test_misma_semilla_misma_vida(perfil):
    cat = catalogo("estable_parecido")
    e = _estado(cat, perfil)
    a = vida_automatica(cat, e, PR, 7, 3, 10)
    b = vida_automatica(cat, e, PR, 7, 3, 10)
    c = vida_automatica(cat, e, PR, 8, 3, 10)
    assert len(a.anios) == 10
    assert _firma(a) == _firma(b) != _firma(c)
    assert [x["edad"] for x in a.anios] == list(range(27, 37))


def test_reproducir_es_determinista_y_hay_una_decision_por_temporada(perfil):
    cat = catalogo("volatil_parecido")
    e = _estado(cat, perfil)
    vida, elecciones = _jugar(cat, e, 4)
    assert len(vida.anios) == 10 and len(elecciones) <= 10
    otra, _ = reproducir(cat, e, PR, 4, 10, elecciones)
    assert _firma(vida) == _firma(otra)


def test_dos_caminos_comparten_la_suerte_del_mundo(perfil):
    cat = catalogo("volatil_parecido")
    e = _estado(cat, perfil)
    for semilla in range(15):
        quedarse, _ = _jugar(cat, e, semilla, "quedarse")
        otra, _ = _jugar(cat, e, semilla, "oferta:0")
        assert [x["recesion"] for x in quedarse.anios] == [x["recesion"] for x in otra.anios]


def test_un_mundo_volatil_tiene_las_recesiones_del_estable_y_mas(perfil):
    estable, volatil = catalogo("estable_parecido"), catalogo("volatil_parecido")
    total_e = total_v = 0
    for i in range(40):
        a = vida_automatica(estable, _estado(estable, perfil), PR, 5, i, 10)
        b = vida_automatica(volatil, _estado(volatil, perfil), PR, 5, i, 10)
        for x, y in zip(a.anios, b.anios):
            assert not x["recesion"] or y["recesion"]
        total_e += sum(x["recesion"] for x in a.anios)
        total_v += sum(x["recesion"] for x in b.anios)
    assert total_v > total_e


def test_los_efectos_se_calculan_sobre_el_estado_previo(perfil):
    """La indemnización usa el sueldo que tenías, aunque el mismo resultado lo deje en 0."""
    cat = catalogo("estable_parecido")
    vida = Vida(cat, _estado(cat, perfil, antiguedad=5), PR, 1)
    cesante = next(r for r in cat.evento_por_id["separacion_empleo"].resultados if r.id == "cesante")
    ahorro = vida.e["ahorro"]
    vida._aplicar(cesante, vida._rng("x"))
    assert vida.e["estado"] == "buscando" and vida.e["sueldo"] == 0
    assert vida.e["ahorro"] == ahorro + 1_800_000 * 5
    assert vida.e["sueldo_ref"] == 1_800_000 * (1 - cat.paquete.k("CAIDA_REEMPLEO"))


def test_los_efectos_con_duracion_se_revierten(perfil):
    cat = catalogo("estable_parecido")
    vida = Vida(cat, _estado(cat, perfil), PR, 1)
    horas = next(o for o in cat.decisiones["trabajar_mas_horas"].opciones if o.id == "si").resultados[0]
    vida._aplicar(horas, vida._rng("x"))
    assert vida.e["horas"] == 55 and vida.e["tiempo_con_tu_gente"] < 1
    vida._cerrar()
    assert vida.e["horas"] == 44 and vida.e["tiempo_con_tu_gente"] == 1


def test_quien_busca_trabajo_ve_el_mercado_de_cesantia(perfil):
    cat = catalogo("estable_parecido")
    e = estado_inicial(cat, {**perfil, "estado": "buscando", "sueldo": 0, "sueldo_ref": 1_500_000})
    _, pendiente = reproducir(cat, e, PR, 1, 10, [])
    assert pendiente.decision.id == "mercado"
    ids = {a.id for a in pendiente.alternativas}
    assert "carta:cesantia:nivel" in ids and "carta:cesantia:informal" not in ids and "quedarse" not in ids


def test_el_mercado_trae_ofertas_reales_y_se_pueden_aceptar(perfil):
    cat = catalogo("estable_parecido")
    e = estado_inicial(cat, {**perfil, "nivel": 1})
    con_oferta = None
    for semilla in range(40):
        _, pendiente = reproducir(cat, e, PR, semilla, 10, [])
        assert pendiente.decision.id == "mercado" and pendiente.alternativas[-1].id == "quedarse"
        ofertas = [a for a in pendiente.alternativas if a.oferta and a.oferta["tipo"] != "startup"]
        if ofertas:
            con_oferta = (semilla, ofertas[0])
            break
    assert con_oferta is not None
    semilla, oferta = con_oferta
    assert oferta.oferta["empresa"] and oferta.oferta["sueldo"] > 0 and oferta.oferta["fuente"]
    vida, _ = _jugar(cat, e, semilla, oferta.id)
    eventos = vida.anios[0]["eventos"]
    assert any(x.get("oferta", {}).get("empresa") == oferta.oferta["empresa"] for x in eventos)


def test_volver_a_trabajar_siempre_deja_un_tipo_de_empleador(perfil):
    cat = catalogo("estable_parecido")
    e = estado_inicial(cat, {**perfil, "estado": "buscando", "sueldo": 0, "sueldo_ref": 900_000, "tipo_empleador": None, "rubro": "Comercio"})
    for i in range(60):
        for a in vida_automatica(cat, e, PR, 11, i, 10, detalle=True).anios:
            assert a["estado"] != "empleado" or a["tipo_empleador"]


def test_nadie_trabaja_sin_sueldo_ni_cobra_sin_trabajo(perfil):
    cat = catalogo("volatil_digital")
    e = estado_inicial(cat, {**perfil, "estado": "buscando", "sueldo": 0, "sueldo_ref": 1_200_000, "riesgo": 100})
    for i in range(80):
        for a in vida_automatica(cat, e, PR, 21, i, 10, detalle=True).anios:
            assert (a["sueldo"] > 0) == (a["estado"] in ("empleado", "fundador")) or a["estado"] == "fundador", (i, a["t"], a["estado"], a["sueldo"])
            assert all(0 <= v <= 100 for v in a["indicadores"].values())


def test_las_prioridades_cambian_la_felicidad_no_la_vida(perfil):
    cat = catalogo("estable_parecido")
    e = _estado(cat, perfil)
    a = vida_automatica(cat, e, {"dinero": 100}, 9, 0, 10)
    b = vida_automatica(cat, e, {"vida_personal": 100}, 9, 0, 10)
    assert _firma(a) == _firma(b) and a.felicidad() != b.felicidad()
