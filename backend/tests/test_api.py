def test_list_decisions(client):
    keys = {d["key"] for d in client.get("/api/decisions").json()}
    assert {"seguir", "sabatico"} <= keys


def test_run_and_fetch(client):
    res = client.post("/api/simulations", json={"decisiones": ["seguir", "trabajar_mas"], "seed": 1})
    assert res.status_code == 200
    body = res.json()
    assert body["edad_final"] == 27
    assert client.get(f"/api/simulations/{body['id']}").status_code == 200


def test_unknown_decision(client):
    assert client.post("/api/simulations", json={"decisiones": ["volar"]}).status_code == 422
