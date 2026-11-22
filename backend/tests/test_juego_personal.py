"""El juego a tu medida: tu relato y los rasgos de tu gemelo."""

from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.deps import get_twin_repo
from app.main import app
from app.services import juego_personal as jp
from app.sim.motor import partida
from app.sim.motor.perfil import Perfil
from app.twin.profile import Dim, TwinProfile


def gemelo(**dims) -> TwinProfile:
    p = TwinProfile()
    for k, m in dims.items():
        p.dims[k] = Dim(m=m, sd=8, n=3)
    return p


def test_sin_relato_ni_gemelo_no_hay_personalizacion():
    assert jp.desde("  ", None) is None


def test_afinidad_sigue_los_rasgos_medidos_y_ignora_los_dudosos():
    arriesgado = jp.afinidad(gemelo(rcar=95, rfin=90, E=85, vind=90, pro=85))
    assert arriesgado["emprender"] > 2 and arriesgado["ahorro"] < 1
    assert "magister" not in arriesgado  # sin rasgos medidos, la carta pesa lo de siempre
    assert jp.afinidad(TwinProfile()) == {}  # gemelo recién creado: todo con duda máxima


def test_la_afinidad_cambia_las_cartas_que_salen_solo_en_tu_partida():
    p = Perfil(edad=28, sueldo=1_500_000, riesgo=5)
    afin = jp.afinidad(gemelo(rcar=98, rfin=95, E=95, vind=95, pro=95))

    def cuentan(afinidad):
        n = 0
        with partida.con_afinidad(afinidad):
            for s in range(40):
                v = partida.jugar(p, s, [])
                n += v.pendiente is not None and v.pendiente.decision["id"] in ("emprender", "independizarse", "unirse_a_startup")
        return n

    assert cuentan(afin) > cuentan({})


def test_la_carta_se_cuenta_a_tu_medida_y_no_cambia_al_volver_a_jugar(monkeypatch):
    llamadas = []

    def ask(prompt, out, **kw):
        llamadas.append(prompt)
        ids = [line.split('"')[1] for line in prompt.splitlines() if line.startswith('- "')]
        return out(situacion="Tu jefa en la oficina de Providencia te para en el pasillo.",
                   opciones=[{"opcion": i, "detalle": f"Para ti, {i}."} for i in ids])

    monkeypatch.setattr(jp, "_llm", lambda: SimpleNamespace(ask=ask))
    monkeypatch.setattr(jp, "get_settings", lambda: SimpleNamespace(llm_enabled=True, anthropic_model="x"))
    jp._cache.clear()
    repo = get_twin_repo()
    g = repo.create(gemelo(rcar=90, rfin=80))
    tc = TestClient(app)
    perfil = {"edad": 28, "sueldo": 1500000, "relato": "Soy diseñadora, odio las reuniones largas.", "gemelo_id": g.id}

    r = tc.post("/api/juego/partida", json={"perfil": perfil, "semilla": 3, "gemelos": 0}).json()
    pend = r["pendiente"]
    assert pend["personalizada"] and pend["narrativa"]["situacion"].startswith("Tu jefa")
    assert all(o["detalle"].startswith("Para ti") for o in pend["opciones"])
    assert "odio las reuniones" in llamadas[0] and "Riesgo de carrera" not in llamadas[0]  # el gemelo no narra

    r2 = tc.post("/api/juego/partida", json={"perfil": perfil, "semilla": 3, "gemelos": 0}).json()
    assert r2["pendiente"]["narrativa"] == pend["narrativa"] and len(llamadas) == 1  # en caché

    eleccion = {"decision": pend["decision"], "opcion": pend["opciones"][0]["opcion"]}
    r3 = tc.post("/api/juego/partida", json={"perfil": perfil, "semilla": 3, "gemelos": 0, "elecciones": [eleccion]}).json()
    vividas = [d for a in r3["historia"] + [r3["anio_en_curso"] or {"decisiones": []}] for d in a["decisiones"]]
    assert any(d.get("narrativa", {}).get("situacion", "").startswith("Tu jefa") for d in vividas)


def test_si_claude_falla_queda_la_plantilla(monkeypatch):
    def falla(*a, **k):
        raise RuntimeError("sin red")

    monkeypatch.setattr(jp, "_llm", lambda: SimpleNamespace(ask=falla))
    monkeypatch.setattr(jp, "get_settings", lambda: SimpleNamespace(llm_enabled=True, anthropic_model="x"))
    jp._cache.clear()
    r = TestClient(app).post("/api/juego/partida", json={"perfil": {"relato": "hola"}, "semilla": 1, "gemelos": 0})
    assert r.status_code == 200 and not r.json()["pendiente"].get("personalizada")
