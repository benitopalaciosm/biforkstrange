"""Perfil desde un texto. No se llama al modelo: se prueba lo que la app hace con lo que el modelo devuelve."""

import pytest

from app.services import perfil_ia
from app.services.perfil_ia import ModeloNoDisponible, PerfilLeido

LEIDO = PerfilLeido(edad=33, sexo="m", edu="universitaria", carrera_id=166, rubro="Finanzas y seguros",
                    tipo_empleador="startup", nivel=2, sueldo=2_624_000, ocupacion=2, antiguedad=3, region="rm",
                    inferido=["sueldo: 82% de 3,2 millones brutos"])


def test_completar_usa_lo_leido_y_marca_lo_que_falta():
    r = perfil_ia.completar(LEIDO)
    assert r["perfil"]["edad"] == 33 and r["perfil"]["carrera_id"] == 166 and r["perfil"]["sueldo"] == 2_624_000
    assert r["perfil"]["riesgo"] == 5  # el texto no lo dice: valor por defecto
    assert [s["campo"] for s in r["supuestos"]] == ["riesgo"]
    assert r["inferido"] == LEIDO.inferido


def test_sin_sueldo_se_usa_la_mediana_de_su_edad_y_estudios():
    r = perfil_ia.completar(LEIDO.model_copy(update={"sueldo": None}))
    assert "sueldo" in [s["campo"] for s in r["supuestos"]]
    # ESI 2025, universitaria, 30-34 (valor literal de esi_perfil_edad_edu.csv)
    assert r["perfil"]["sueldo"] == 1_097_145


def test_valores_fuera_de_rango_o_inventados_se_descartan():
    raro = LEIDO.model_copy(update={"rubro": "Criptomonedas", "edad": 12, "carrera_id": 999, "nivel": 9})
    r = perfil_ia.completar(raro)
    faltan = {s["campo"] for s in r["supuestos"]}
    assert {"rubro", "edad", "nivel"} <= faltan
    assert r["perfil"]["rubro"] == "Servicios profesionales" and r["perfil"]["carrera_id"] == -1


def test_texto_vacio_o_demasiado_largo():
    with pytest.raises(ValueError):
        perfil_ia.leer("   ", "2026-11-21")
    with pytest.raises(ValueError):
        perfil_ia.leer("x" * (perfil_ia.MAX_CARACTERES + 1), "2026-11-21")


def test_sin_credenciales_ni_comando_se_avisa(monkeypatch):
    monkeypatch.setattr(perfil_ia, "_hay_credenciales", lambda: False)
    monkeypatch.setattr(perfil_ia.shutil, "which", lambda _: None)
    with pytest.raises(ModeloNoDisponible):
        perfil_ia.leer("Soy contadora", "2026-11-21")


def test_api_perfil(client, monkeypatch):
    monkeypatch.setattr(perfil_ia, "leer", lambda texto, hoy, pq=None: (LEIDO, "api"))
    r = client.post("/api/juego/perfil", json={"texto": "Soy Camila..."})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["perfil"]["tipo_empleador"] == "startup" and cuerpo["via"] == "api"
    # el perfil devuelto sirve tal cual para empezar una partida
    assert client.post("/api/juego/partida", json={"perfil": cuerpo["perfil"], "duda": "emprender", "gemelos": 0}).status_code == 200


def test_api_perfil_sin_modelo_da_503(client, monkeypatch):
    def falla(texto, hoy, pq=None):
        raise ModeloNoDisponible("sin credenciales")

    monkeypatch.setattr(perfil_ia, "leer", falla)
    assert client.post("/api/juego/perfil", json={"texto": "hola"}).status_code == 503
    assert client.post("/api/juego/perfil", json={"texto": ""}).status_code == 422


# ── documento armado por el Claude de la persona ──────────────────────────────

from pathlib import Path

from app.services import perfil_doc

EJEMPLO = (Path(__file__).parents[2] / "docs" / "motor" / "perfil-ejemplo.md").read_text(encoding="utf-8")


def test_el_prompt_trae_el_formato_y_las_listas_validas():
    p = perfil_doc.prompt()
    assert "```gemelo-laboral" in p and "## Cómo lo deduje" in p
    assert "Finanzas y seguros" in p and "unirse_a_startup:" in p
    assert "tener_hijo" not in p  # solo lo laboral


def test_el_documento_de_ejemplo_se_lee_exacto_y_sin_modelo(monkeypatch):
    monkeypatch.setattr(perfil_ia, "leer", lambda *a, **k: (_ for _ in ()).throw(AssertionError("no debe llamar al modelo")))
    r = perfil_ia.perfil_desde_texto(EJEMPLO, "2026-11-21")
    assert r["via"] == "documento" and r["duda"] == "emprender" and r["avisos"] == [] and r["supuestos"] == []
    assert r["perfil"] | {"ahorro": None} == {
        "edad": 33, "sexo": "m", "edu": "universitaria", "carrera_id": 166, "rubro": "Finanzas y seguros",
        "tipo_empleador": "startup", "nivel": 2, "sueldo": 2_624_000, "riesgo": 4, "ocupacion": 2,
        "antiguedad": 3, "region": "rm", "ahorro": None}
    assert any("82%" in frase for frase in r["inferido"])


def test_documento_con_valores_libres_o_malos():
    doc = "```gemelo-laboral\nsexo: hombre\nestudios: técnica\ntipo_empresa: Estado\ncargo: jefatura\n" \
          "rubro: construccion\nsueldo_liquido: $1.250.000\nriesgo: 15\nedad: ?\nduda: volar\n```"
    r = perfil_doc.leer_documento(doc)
    p = r["perfil"]
    assert (p["sexo"], p["edu"], p["tipo_empleador"], p["nivel"], p["rubro"], p["sueldo"]) == \
           ("h", "tecnica", "publico", 3, "Construcción", 1_250_000)
    assert {"edad", "riesgo"} <= {s["campo"] for s in r["supuestos"]}
    assert any("riesgo" in a for a in r["avisos"]) and any("volar" in a for a in r["avisos"])
    assert r["duda"] is None


def test_carrera_parecida_se_avisa_y_desconocida_queda_sin_carrera():
    pq = perfil_ia.paquete()
    cid, nota = perfil_doc._carrera("Ing. Civil Industrial", "U", pq)
    assert cid is not None and "se tomó como" in nota
    cid, nota = perfil_doc._carrera("Astrología cuántica", "U", pq)
    assert cid is None and "no está en el catálogo" in nota


def test_texto_sin_bloque_no_es_documento():
    assert perfil_doc.leer_documento("Soy contadora y trabajo en una pyme.") is None


def test_api_prompt(client):
    assert "```gemelo-laboral" in client.get("/api/juego/prompt").json()["prompt"]
