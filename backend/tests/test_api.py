def test_catalogo(client):
    body = client.get("/api/catalogo").json()
    assert len(body["mundos"]) == 4 and "Finanzas y seguros" in body["rubros"] and body["politica_base"]["oferta_externa"]


def test_gemelo_valida_el_perfil(client, perfil, prioridades):
    assert client.post("/api/gemelo", json={"perfil": perfil, "prioridades": prioridades}).status_code == 200
    assert client.post("/api/gemelo", json={"perfil": {**perfil, "rubro": ""}}).status_code == 422
    assert client.post("/api/gemelo", json={"perfil": {**perfil, "rubro": "Astrología"}}).status_code == 422
    assert client.post("/api/gemelo", json={"perfil": {**perfil, "sueldo": 0}}).status_code == 422


def test_carrera_completa_y_suerte(client, perfil, prioridades):
    body = {"perfil": perfil, "prioridades": prioridades, "mundo": "volatil_parecido", "semilla": 11, "elecciones": []}
    while True:
        res = client.post("/api/partidas/turno", json=body)
        assert res.status_code == 200, res.text
        turno = res.json()
        if turno["terminada"]:
            break
        p = turno["pendiente"]
        assert p["decision"]["id"] in ("mercado", "seguir_con_tu_empresa", "licencia_salud_mental")
        for o in p["opciones"]:
            assert set(o["efectos"]["puntos"]) == {"dinero", "carrera", "bienestar", "vida_personal"} and o["arte"]
        body["elecciones"].append(p["opciones"][0]["id"])
    assert len(turno["anios"]) == 10 and turno["resumen"]["felicidad"] > 0
    assert all(a["tono"] in ("dia", "noche") and "indicadores_inicio" in a for a in turno["anios"])

    r = turno["resumen"]
    suerte = client.post("/api/suerte", json={**body, "n": 60, "felicidad": r["felicidad"], "sueldo_final": r["sueldo_final"], "ingreso_acumulado": r["ingreso_acumulado"]}).json()
    assert suerte["n"] == 60 and 0 <= suerte["percentil_felicidad"] <= 100


def test_elecciones_invalidas(client, perfil):
    base = {"perfil": perfil, "mundo": "estable_parecido", "semilla": 1}
    assert client.post("/api/partidas/turno", json={**base, "elecciones": ["volar"]}).status_code == 422
    assert client.post("/api/partidas/turno", json={**base, "mundo": "marte", "elecciones": []}).status_code == 422


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


def test_calibracion(client):
    c = client.get("/api/calibracion").json()
    assert c["total"] >= 10 and c["calzan"] >= c["total"] - 1
