import base64
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
    assert [s["campo"] for s in r["supuestos"]] == ["riesgo", "ingles"]  # el CV no habla de idiomas
    assert r["inferido"] == LEIDO.inferido


def test_sin_sueldo_se_usa_la_mediana_de_su_edad_y_estudios():
    r = perfil_ia.completar(LEIDO.model_copy(update={"sueldo": None}))
    assert "sueldo" in [s["campo"] for s in r["supuestos"]]
    # ESI 2025, universitaria, 30-34 (valor literal de esi_perfil_edad_edu.csv)
    assert r["perfil"]["sueldo"] == 1_100_000


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
    monkeypatch.setattr(perfil_ia, "leer", lambda texto, hoy, pq=None, pdf=None: (LEIDO, "api"))
    r = client.post("/api/juego/perfil", json={"texto": "Soy Camila..."})
    assert r.status_code == 200
    cuerpo = r.json()
    assert cuerpo["perfil"]["tipo_empleador"] == "startup" and cuerpo["via"] == "api"
    # el perfil devuelto sirve tal cual para empezar una partida
    assert client.post("/api/juego/partida", json={"perfil": cuerpo["perfil"], "duda": "emprender", "gemelos": 0}).status_code == 200


def test_api_perfil_sin_modelo_da_503(client, monkeypatch):
    def falla(texto, hoy, pq=None, pdf=None):
        raise ModeloNoDisponible("sin credenciales")

    monkeypatch.setattr(perfil_ia, "leer", falla)
    assert client.post("/api/juego/perfil", json={"texto": "hola"}).status_code == 503
    assert client.post("/api/juego/perfil", json={"texto": ""}).status_code == 422



def test_api_perfil_desde_pdf(client, monkeypatch):
    recibido = {}

    def leer(texto, hoy, pq=None, pdf=None):
        recibido["pdf"] = pdf
        return LEIDO, "api"

    monkeypatch.setattr(perfil_ia, "leer", leer)
    pdf = base64.b64encode(b"%PDF-1.7 cv de prueba").decode()
    r = client.post("/api/juego/perfil", json={"pdf": f"data:application/pdf;base64,{pdf}"})
    assert r.status_code == 200 and recibido["pdf"] == b"%PDF-1.7 cv de prueba"


def test_api_perfil_rechaza_lo_que_no_es_pdf(client):
    otro = base64.b64encode(b"PK\x03\x04 un zip").decode()
    r = client.post("/api/juego/perfil", json={"pdf": otro})
    assert r.status_code == 422 and "no es un PDF" in r.json()["detail"]
    assert client.post("/api/juego/perfil", json={"pdf": "no es base64!!"}).status_code == 422


def test_el_pdf_va_como_documento_a_la_api(monkeypatch):
    llamada = {}

    class Mensajes:
        def parse(self, **k):
            llamada.update(k)
            return type("R", (), {"stop_reason": "end_turn", "parsed_output": LEIDO})()

    monkeypatch.setattr(perfil_ia.anthropic, "Anthropic", lambda **k: type("C", (), {"messages": Mensajes()})())
    perfil_ia._por_api("", "2026-11-21", perfil_ia.paquete(), b"%PDF-1.7")
    bloques = llamada["messages"][0]["content"]
    assert bloques[0]["type"] == "document" and bloques[0]["source"]["media_type"] == "application/pdf"
    assert llamada["model"] == "claude-haiku-5-5" and llamada["thinking"] == {"type": "disabled"}

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
        "antiguedad": 3, "region": "rm", "ahorro": None, "ingles": 1, "skill": 57, "red": 35,
        "estado": "empleado", "meses_cesante": 0, "parcial": 0, "remoto": 0, "usa_ia": 0, "empresa_anos": 0,
        "empresa_fondos": 0, "anos_por_empleo": 3.0, "semestres_restantes": None, "anos_en_carrera": None}
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


def test_cargo_por_nombre_no_borra_el_aviso_de_otro_campo():
    r = perfil_doc.leer_documento("```gemelo-laboral\ncargo: Senior\nantiguedad: tres\n```")
    assert r["perfil"]["nivel"] == 2
    assert not any(a.startswith("cargo:") for a in r["avisos"])
    assert any(a.startswith("antigüedad:") for a in r["avisos"])


def test_catalogo_trae_la_referencia_de_sueldos(client):
    ref = client.get("/api/juego/catalogo").json()["sueldos_ref"]
    fila = next(f for f in ref if f["educacion"] == "universitaria" and f["banda"] == "30-34")
    assert fila["p25"] < fila["p50"] < fila["p75"] and fila["p50"] % 10_000 == 0


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


def test_las_dudas_sugeridas_se_filtran_por_el_perfil():
    leido = LEIDO.model_copy(update={
        "dudas_sugeridas": [
            perfil_ia.DudaSugerida(decision="volar_a_marte", por_que="no existe"),
            perfil_ia.DudaSugerida(decision="emprender", por_que="Llevas años pensando en tu idea."),
            perfil_ia.DudaSugerida(decision="emprender", por_que="repetida"),
        ],
        "retrato": "  Eres contadora en una startup.  ",
    })
    r = perfil_ia.completar(leido)
    assert [d["decision"] for d in r["dudas_sugeridas"]] == ["emprender"]
    assert r["dudas_sugeridas"][0]["por_que"] == "Llevas años pensando en tu idea."
    assert r["retrato"] == "Eres contadora en una startup."


def test_ingles_experiencia_y_empresa_del_sii():
    leido = LEIDO.model_copy(update={"ingles": True, "anios_experiencia": 8, "empleadores": 3,
                                     "tipo_empleador": None, "rubro": None,
                                     "empresa_actual": "I. Municipalidad de Curicó"})
    r = perfil_ia.completar(leido)
    p = r["perfil"]
    assert (p["ingles"], p["skill"], p["red"]) == (1, 55, 35)
    # la empresa está en el SII: tamaño y rubro son dato, no supuesto
    assert r["empresa"]["tamano"] == "grande" and p["tipo_empleador"] == "grande"
    assert p["rubro"] == "Administración pública"
    assert not {"tipo_empleador", "rubro", "ingles"} & {s["campo"] for s in r["supuestos"]}


def test_sin_datos_nuevos_el_motor_usa_los_supuestos_de_siempre():
    from app.sim.motor.paquete import paquete
    from app.sim.motor.perfil import Perfil, estado_inicial

    e = estado_inicial(Perfil(), paquete())
    assert (e["ingles"], e["skill"], e["red"]) == (0, 50, 30)
    e = estado_inicial(Perfil(ingles=1, skill=70, red=50), paquete())
    assert (e["ingles"], e["skill"], e["red"]) == (1, 70, 50)


def test_sin_cv_la_habilidad_se_estima_por_los_anios_desde_el_titulo():
    from app.sim.motor.paquete import paquete
    from app.sim.motor.perfil import Perfil, estado_inicial

    pq = paquete()
    assert estado_inicial(Perfil(edad=24, edu="universitaria"), pq)["skill"] == 35  # recién titulado
    assert estado_inicial(Perfil(edad=45, edu="universitaria"), pq)["skill"] == 87
    assert estado_inicial(Perfil(edad=45, skill=40), pq)["skill"] == 40  # el dato del CV manda
    assert estado_inicial(Perfil.a_los_18(), pq)["skill"] == 50  # la cohorte de validación no cambia


def test_situacion_y_trayectoria_del_cv():
    leido = LEIDO.model_copy(update={"situacion": "buscando", "meses_sin_trabajo": 10, "remoto": True, "usa_ia": True,
                                     "anios_experiencia": 6, "empleadores": 5})
    p = perfil_ia.completar(leido)["perfil"]
    assert (p["estado"], p["meses_cesante"], p["remoto"], p["usa_ia"], p["anos_por_empleo"]) == ("buscando", 10, 1, 1, 1.2)


def test_la_situacion_llega_al_motor():
    from app.sim.motor.paquete import paquete
    from app.sim.motor.perfil import Perfil, estado_inicial

    pq = paquete()
    e = estado_inicial(Perfil(estado="buscando", meses_cesante=10, sueldo=900_000), pq)
    assert (e["estado"], e["hueco"], e["meses_cesante"]) == ("buscando", 1, 10)
    e = estado_inicial(Perfil(parcial=1, remoto=1, usa_ia=1), pq)
    assert (e["horas"], e["remoto"], e["usa_ia"]) == (22, 1, 1)
    e = estado_inicial(Perfil(), pq)
    assert (e["hueco"], e["horas"], e["remoto"], e["usa_ia"]) == (0, 44, 0, 0)  # sin datos: como antes


def test_cuanto_le_falta_a_quien_estudia():
    estudia = LEIDO.model_copy(update={"situacion": "estudiando", "edad": 21, "edu": "media"})
    r = perfil_ia.completar(estudia.model_copy(update={"anio_egreso_esperado": 2028}), hoy="2026-11-21")
    assert r["perfil"]["semestres_restantes"] == 4 and r["perfil"]["anos_en_carrera"] is None
    assert any("2028" in f and "2 años más" in f for f in r["inferido"])
    r = perfil_ia.completar(estudia.model_copy(update={"anio_que_cursa": 3}), hoy="2026-11-21")
    assert r["perfil"]["anos_en_carrera"] == 2 and r["perfil"]["semestres_restantes"] is None
    r = perfil_ia.completar(estudia, hoy="2026-11-21")  # sin dato: el supuesto se dice como supuesto
    assert r["perfil"]["semestres_restantes"] is None and any("supuesto del equipo" in f for f in r["inferido"])
    # quien trabaja no recibe estos campos ni la frase, aunque el texto diga un año de egreso
    r = perfil_ia.completar(LEIDO.model_copy(update={"anio_egreso_esperado": 2028}), hoy="2026-11-21")
    assert r["perfil"]["semestres_restantes"] is None and not any("titular" in f for f in r["inferido"])


def test_los_gemelos_se_cambian_como_tu():
    from app.sim.motor.politicas import pesos_personales

    assert pesos_personales({}) == {}
    seguido = pesos_personales({"anos_por_empleo": 1.0})["oferta_externa"]["cambiar"]
    quieto = pesos_personales({"anos_por_empleo": 8.0})["oferta_externa"]["cambiar"]
    assert quieto < 0.34 < seguido <= 0.65
