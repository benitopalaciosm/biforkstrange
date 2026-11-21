def test_catalogo(client):
    body = client.get("/api/catalogo").json()
    assert len(body["mundos"]) == 4 and len(body["carreras"]) == 252
    assert "Finanzas y seguros" in body["rubros"]


def test_gemelo_trae_gente_como_tu_y_bifurcaciones(client, perfil, prioridades):
    res = client.post("/api/gemelo", json={"perfil": perfil, "prioridades": prioridades})
    assert res.status_code == 200
    body = res.json()
    assert body["estado"]["percentil"] == 85
    assert all(f["fuentes"] and f["calidad"] in ("dato", "mixto", "supuesto") for f in body["gente_como_tu"])
    ids = {b["id"] for b in body["bifurcaciones"]}
    assert {"cambiarme", "startup", "emprender"} <= ids and "cesante" not in ids
    for b in body["bifurcaciones"]:
        for lado in ("a", "b"):
            assert abs(sum(r["prob"] for r in b[lado]["resultados"]) - 1) < 1e-3


def test_perfil_incompleto(client, perfil):
    assert client.post("/api/gemelo", json={"perfil": {**perfil, "rubro": ""}}).status_code == 422
    assert client.post("/api/gemelo", json={"perfil": {**perfil, "rubro": "Astrología"}}).status_code == 422
    assert client.post("/api/gemelo", json={"perfil": {**perfil, "sueldo": 0}}).status_code == 422


def _jugar(client, body):
    while True:
        res = client.post("/api/partidas/turno", json=body)
        assert res.status_code == 200, res.text
        turno = res.json()
        if turno["terminada"]:
            return turno
        body["elecciones"] = body["elecciones"] + [turno["pendiente"]["opciones"][0]["id"]]


def test_partida_completa_y_comparacion(client, perfil, prioridades):
    body = {"perfil": perfil, "prioridades": prioridades, "mundo": "volatil_parecido", "semilla": 11, "bifurcacion": "startup", "elecciones": []}
    primero = client.post("/api/partidas/turno", json=body).json()
    assert primero["pendiente"]["origen"] == "bifurcacion"
    assert [o["id"] for o in primero["pendiente"]["opciones"]] == ["ir", "quedarse"]

    body["elecciones"] = ["ir"]
    final = _jugar(client, body)
    assert len(final["anios"]) == 10 and 0 <= final["resumen"]["felicidad"] <= 100

    res = client.post("/api/comparaciones", json={
        "perfil": perfil, "prioridades": prioridades, "bifurcacion": "startup", "n": 60,
        "partidas": [{"mundo": "volatil_parecido", "semilla": 11, "elecciones": body["elecciones"]}],
    })
    assert res.status_code == 200, res.text
    comp = res.json()
    assert len(comp["mundos"]) == 4 and comp["veredicto"]["frase"]
    assert comp["partidas"][0]["camino"] == "a" and 0 <= comp["partidas"][0]["percentil"] <= 100
    assert client.get(f"/api/comparaciones/{comp['id']}").json()["veredicto"] == comp["veredicto"]
    assert client.get("/api/comparaciones/no-existe").status_code == 404


def test_elecciones_invalidas(client, perfil):
    base = {"perfil": perfil, "mundo": "estable_parecido", "semilla": 1, "bifurcacion": "startup"}
    assert client.post("/api/partidas/turno", json={**base, "elecciones": ["volar"]}).status_code == 422
    assert client.post("/api/partidas/turno", json={**base, "mundo": "marte", "elecciones": []}).status_code == 422
    assert client.post("/api/partidas/turno", json={**base, "bifurcacion": "nada", "elecciones": []}).status_code == 422
    assert client.post("/api/comparaciones", json={"perfil": perfil, "bifurcacion": "cesante", "n": 50}).status_code == 422


def test_sin_claude_el_juego_no_se_cae(client, perfil):
    from app.api.deps import get_claude_service
    from app.main import app
    from app.services.claude_service import ClaudeService

    app.dependency_overrides[get_claude_service] = lambda: ClaudeService(None)
    assert client.get("/api/catalogo").json()["claude"] is False
    assert client.post("/api/historia", json={"perfil": perfil, "anio": {"t": 0, "eventos": []}}).json() == {"anio": None, "caso": None}
    assert client.post("/api/epilogo", json={"perfil": perfil, "camino": "x", "historia": [], "resumen": {}, "anio_final": 2036}).json() == {"epilogo": None}
    assert client.post("/api/gemelo/leer", data={"sobre_ti": "hola"}).status_code == 503
    assert client.post("/api/gemelo/leer", data={"sobre_ti": ""}).status_code == 422


def test_caminos_sin_claude_trae_cartas_con_efectos(client, perfil):
    from app.api.deps import get_claude_service
    from app.main import app
    from app.services.claude_service import ClaudeService

    app.dependency_overrides[get_claude_service] = lambda: ClaudeService(None)
    body = client.post("/api/caminos", json={"perfil": perfil, "semilla": 7}).json()
    assert body["por_claude"] is False and body["total"] >= 4 and len(body["caminos"]) == 4
    for c in body["caminos"]:
        assert set(c["a"]["efectos"]["puntos"]) == {"dinero", "carrera", "bienestar", "vida_personal"} and c["a"]["arte"]
    startup = client.post("/api/caminos", json={"perfil": perfil, "semilla": 7}).json()["caminos"]
    assert startup == body["caminos"]  # misma semilla, mismas empresas


def test_cada_anio_trae_lo_que_la_pantalla_cuenta(client, perfil):
    body = {"perfil": perfil, "mundo": "volatil_parecido", "semilla": 3, "bifurcacion": "horas", "elecciones": ["si"]}
    turno = client.post("/api/partidas/turno", json=body).json()
    while not turno["anios"]:  # ese mismo año puede llegar otra pregunta
        body["elecciones"].append(turno["pendiente"]["opciones"][-1]["id"])
        turno = client.post("/api/partidas/turno", json=body).json()
    anio = turno["anios"][0]
    assert anio["escena"] == "oficina" and anio["tono"] == "noche" and anio["horas"] == 55
    assert anio["fines_con_tu_gente"] < 26 and anio["te_perdiste"]
    assert set(anio["indicadores_inicio"]) == set(anio["indicadores"])


def test_la_bifurcacion_debe_aplicar_al_perfil(client, perfil):
    body = {"perfil": {**perfil, "tipo_empleador": "startup"}, "mundo": "estable_parecido", "semilla": 1, "bifurcacion": "startup", "elecciones": []}
    assert client.post("/api/partidas/turno", json=body).status_code == 422


def test_fuentes_y_calibracion(client):
    f = client.get("/api/fuentes").json()
    assert f["resumen"]["parametros"] == {"dato": 29, "mixto": 25, "supuesto": 13}
    c = client.get("/api/calibracion").json()
    assert c["total"] >= 10 and c["calzan"] >= c["total"] - 1
