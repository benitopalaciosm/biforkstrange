"""Lo que vale cada línea del CV: la duda con cada dato y sin él, con los mismos dados.

Como en test_api_juego, no se fijan números del motor (se está calibrando): se fija la forma,
que "con el dato" sea la misma comparación que muestra la carta, y que sea determinista.
"""

N = 40  # gemelos por opción: pocos, para que el test sea rápido
CV = {"ingles": 1, "skill": 75, "red": 60, "usa_ia": 1, "nivel": 2, "edu": "postgrado", "anos_por_empleo": 2.5}


def _peso(client, **body) -> dict:
    r = client.post("/api/juego/peso-cv", json={"gemelos": N, "semilla": 7, **body})
    assert r.status_code == 200, r.text
    return r.json()


def test_forma_y_orden(client):
    p = _peso(client, perfil=CV, duda="emigrar")
    assert p["decision"] == "emigrar" and p["gemelos"] == N and p["pregunta"]
    assert 0 < len(p["datos"]) <= 4
    cambios = [d["cambio"] for d in p["datos"]]
    assert cambios == sorted(cambios, reverse=True)
    campos = [d["campo"] for d in p["datos"]] + p["sin_efecto"] + p["otros"]
    assert len(campos) == len(set(campos)) and set(campos) <= set(CV)
    for d in p["datos"]:
        assert d["tuyo"] == CV[d["campo"]] and d["tuyo"] != d["neutro"]
        assert d["mueve"] in ("gana", "sueldo")
        assert d["opcion"] in [o["opcion"] for o in d["opciones"]]
        for o in d["opciones"]:
            assert 0 <= o["gana_con"] <= 1 and 0 <= o["gana_sin"] <= 1
            assert o["sueldo_con"] > 0 and o["sueldo_sin"] > 0


def test_el_ingles_pesa_al_emigrar(client):
    p = _peso(client, perfil=CV, duda="emigrar")
    assert "ingles" in [d["campo"] for d in p["datos"]]


def test_con_el_dato_es_la_carta_de_la_duda(client):
    """Mismo perfil, semilla y gemelos: "con" son los mismos mundos que ve la persona en su carta."""
    p = _peso(client, perfil=CV, duda="emigrar")
    r = client.post("/api/juego/partida", json={"perfil": CV, "duda": "emigrar", "semilla": 7, "gemelos": N})
    comp = r.json()["pendiente"]["comparacion"]
    ganadores = comp["ganador_por_mundo"]
    tipicos = {o["opcion"]: o["sueldo"]["p50"] for o in comp["opciones"]}
    for d in p["datos"]:
        for o in d["opciones"]:
            assert o["gana_con"] == ganadores.count(o["opcion"]) / len(ganadores)
            assert o["sueldo_con"] == tipicos[o["opcion"]]


def test_sin_datos_del_cv_no_hay_nada_que_pesar(client):
    """Un perfil que ya está en los valores neutros no tiene líneas que quitar."""
    p = _peso(client, perfil={"edu": "media"}, duda="oferta_externa")
    assert p["datos"] == [] and p["sin_efecto"] == [] and p["otros"] == []


def test_es_determinista(client):
    a = _peso(client, perfil=CV, duda="oferta_externa")
    b = _peso(client, perfil=CV, duda="oferta_externa")
    assert a == b


def test_duda_que_no_aplica(client):
    r = client.post("/api/juego/peso-cv", json={"perfil": {"tipo_empleador": "startup"}, "duda": "unirse_a_startup"})
    assert r.status_code == 422
