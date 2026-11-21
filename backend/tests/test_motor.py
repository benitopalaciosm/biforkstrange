from app.sim.catalogo import catalogo, ids_mundos
from app.sim.gemelo import estado_inicial
from app.sim.montecarlo import comparar_en_mundo, reproducir, vida_automatica
from app.sim.motor import Vida

PR = {"dinero": 40, "vida_personal": 30, "carrera": 20, "bienestar": 10}


def _estado(cat, perfil):
    return estado_inicial(cat, {**perfil, "riesgo": 75})


def _firma(vida):
    return [(a["estado"], round(a["sueldo"]), round(a["ahorro"]), a["recesion"]) for a in vida.anios]


def test_misma_semilla_misma_vida(perfil):
    cat = catalogo("estable_parecido")
    e = _estado(cat, perfil)
    a = vida_automatica(cat, e, PR, 7, 3, 10, ("oferta_externa", "cambiar"))
    b = vida_automatica(cat, e, PR, 7, 3, 10, ("oferta_externa", "cambiar"))
    c = vida_automatica(cat, e, PR, 8, 3, 10, ("oferta_externa", "cambiar"))
    assert len(a.anios) == 10
    assert _firma(a) == _firma(b)
    assert _firma(a) != _firma(c)
    assert [x["edad"] for x in a.anios] == list(range(27, 37))


def test_los_dos_caminos_comparten_la_suerte_del_mundo(perfil):
    cat = catalogo("volatil_parecido")
    e = _estado(cat, perfil)
    for i in range(25):
        a = vida_automatica(cat, e, PR, 5, i, 10, ("unirse_a_startup", "ir"))
        b = vida_automatica(cat, e, PR, 5, i, 10, ("unirse_a_startup", "quedarse"))
        assert [x["recesion"] for x in a.anios] == [x["recesion"] for x in b.anios]


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
    vida = Vida(cat, _estado(cat, {**perfil, "antiguedad": 5}), PR, 1)
    cesante = next(r for r in cat.evento_por_id["separacion_empleo"].resultados if r.id == "cesante")
    ahorro = vida.e["ahorro"]
    vida._aplicar(cesante, vida._rng("x"))
    assert vida.e["estado"] == "buscando" and vida.e["sueldo"] == 0
    assert vida.e["ahorro"] == ahorro + 1_800_000 * 5
    assert vida.e["sueldo_ref"] == 1_800_000 * (1 - cat.paquete.k("CAIDA_REEMPLEO"))


def test_los_efectos_con_duracion_se_revierten(perfil):
    cat = catalogo("estable_parecido")
    e = _estado(cat, perfil)
    elecciones = ["si"]
    vida, pendiente = reproducir(cat, e, PR, 3, 1, elecciones, "trabajar_mas_horas")
    while pendiente is not None:  # ese año puede llegar además una oferta
        elecciones.append(pendiente.alternativas[-1].id)
        vida, pendiente = reproducir(cat, e, PR, 3, 1, elecciones, "trabajar_mas_horas")
    assert vida.e["horas"] == 44 and vida.e["tiempo_con_tu_gente"] == 1
    assert any(x["id"] == "trabajar_mas_horas" for x in vida.anios[0]["eventos"])


def test_reproducir_se_detiene_en_la_pregunta_pendiente(perfil):
    cat = catalogo("estable_parecido")
    e = _estado(cat, perfil)
    vida, pendiente = reproducir(cat, e, PR, 3, 10, [], "oferta_externa")
    assert pendiente is not None and pendiente.origen == "bifurcacion" and pendiente.anio == 0
    assert {a.id for a in pendiente.alternativas} == {"cambiar", "contraoferta", "quedarse"}
    elecciones = ["cambiar"]
    while pendiente is not None:
        vida, pendiente = reproducir(cat, e, PR, 3, 10, elecciones, "oferta_externa")
        if pendiente is not None:
            elecciones.append(pendiente.alternativas[-1].id)
    assert len(vida.anios) == 10
    otra, _ = reproducir(cat, e, PR, 3, 10, elecciones, "oferta_externa")
    assert _firma(vida) == _firma(otra)


def test_quien_busca_trabajo_recibe_la_carta_de_cesantia(perfil):
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
        vida, pendiente = reproducir(cat, e, PR, semilla, 10, [])
        ofertas = [a for a in pendiente.alternativas if a.oferta]
        assert pendiente.decision.id == "mercado" and pendiente.alternativas[-1].id == "quedarse"
        if ofertas:
            con_oferta = (semilla, ofertas[0])
            break
    assert con_oferta is not None
    semilla, oferta = con_oferta
    assert oferta.oferta["empresa"] and oferta.oferta["sueldo"] > 0 and oferta.oferta["fuente"]
    elecciones = [oferta.id]
    vida, pendiente = reproducir(cat, e, PR, semilla, 10, elecciones)
    while not vida.anios:
        elecciones.append(pendiente.alternativas[-1].id)
        vida, pendiente = reproducir(cat, e, PR, semilla, 10, elecciones)
    eventos = vida.anios[0]["eventos"]
    assert any(x.get("oferta", {}).get("empresa") == oferta.oferta["empresa"] for x in eventos)
    if oferta.oferta["tipo"] != "startup":
        assert vida.anios[0]["empleador"]["nombre"] == oferta.oferta["empresa"] or vida.anios[0]["estado"] != "empleado"


def test_volver_a_trabajar_siempre_deja_un_tipo_de_empleador(perfil):
    cat = catalogo("estable_parecido")
    e = estado_inicial(cat, {**perfil, "estado": "buscando", "sueldo": 0, "sueldo_ref": 900_000, "tipo_empleador": None, "rubro": "Comercio"})
    for i in range(60):
        vida = vida_automatica(cat, e, PR, 11, i, 10, ("cesantia", "bootcamp"), detalle=True)
        for a in vida.anios:
            assert a["estado"] != "empleado" or a["tipo_empleador"]


def test_comparacion_en_los_cuatro_mundos(perfil):
    for mid in ids_mundos():
        cat = catalogo(mid)
        r = comparar_en_mundo(cat, _estado(cat, perfil), PR, "unirse_a_startup", "ir", "quedarse", 60, 2026, 10)
        assert 0 <= r["prob_gana_a"] <= 1 and r["margen"] > 0
        for lado in ("a", "b"):
            f = r[lado]["felicidad"]
            assert 0 <= f["p10"] <= f["p50"] <= f["p90"] <= 100
            assert len(r[lado]["sueldo_por_anio"]) == 10
        assert set(r["prob_gana_a_por_indicador"]) == {"dinero", "carrera", "bienestar", "vida_personal"}


def test_las_prioridades_cambian_la_felicidad_no_la_vida(perfil):
    cat = catalogo("estable_parecido")
    e = _estado(cat, perfil)
    a = vida_automatica(cat, e, {"dinero": 100}, 9, 0, 10)
    b = vida_automatica(cat, e, {"vida_personal": 100}, 9, 0, 10)
    assert _firma(a) == _firma(b)
    assert a.felicidad() != b.felicidad()


def test_nadie_trabaja_sin_sueldo_ni_cobra_sin_trabajo(perfil):
    """Invariantes sobre todos los caminos de una persona que parte sin pega (el caso más frágil)."""
    cat = catalogo("volatil_digital")
    e = estado_inicial(cat, {**perfil, "estado": "buscando", "sueldo": 0, "sueldo_ref": 1_200_000, "riesgo": 100})
    for decision, opcion in [("emprender", "emprender"), ("emigrar", "irse"), ("bootcamp", "hacer"), ("sabatico", "irse"), ("cesantia", "nivel")]:
        for i in range(40):
            vida = vida_automatica(cat, e, PR, 21, i, 10, (decision, opcion), detalle=True)
            for a in vida.anios:
                assert (a["sueldo"] > 0) == (a["estado"] in ("empleado", "fundador")) or a["estado"] == "fundador", (decision, i, a["t"], a["estado"], a["sueldo"])
                assert all(0 <= v <= 100 for v in a["indicadores"].values())
