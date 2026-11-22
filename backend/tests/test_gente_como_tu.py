"""Gente como tú, de verdad: datos reales filtrados por el perfil, cada uno con su fuente.

Los números salen de las tablas del paquete, así que aquí se revisa que cada dato sea la celda
correcta de su tabla (no un cálculo nuevo) y que la API lo entregue con su fuente.
"""

import pytest

from app.sim.motor import gente
from app.sim.motor.paquete import paquete


def _fila(tabla: str, **filtro) -> dict:
    return next(f for f in paquete().filas(tabla) if all(f[k] == v for k, v in filtro.items()))


def _por_clave(datos: list[dict]) -> dict:
    return {d["clave"]: d for d in datos}


@pytest.mark.parametrize(("edad", "banda_esi", "banda_eps"), [
    (18, "18-24", "18-29"), (24, "18-24", "18-29"), (25, "25-29", "18-29"), (29, "25-29", "18-29"),
    (30, "30-34", "30-44"), (44, "40-44", "30-44"), (45, "45-49", "45-59"), (50, "50-54", "45-59"),
])
def test_bandas_de_edad(edad, banda_esi, banda_eps):
    assert gente._banda_esi(edad) == banda_esi
    assert gente._banda_eps(edad) == banda_eps


def test_sueldo_de_tu_rubro_y_edad_es_la_celda_de_la_esi():
    d = gente.sueldo(31, "m", "universitaria", "Servicios profesionales")
    fila = _fila("esi_ingreso_rubro_edad", rubro="Servicios profesionales", banda_edad="30-34")
    assert d["tabla"] == "esi_ingreso_rubro_edad"
    assert d["cifra"] == round(float(fila["p50"]))
    assert d["n"] == int(fila["n"])
    assert "Servicios profesionales" in d["frase"] and "30 a 34 años" in d["frase"]
    assert "Encuesta Suplementaria de Ingresos" in d["fuente"]


def test_sin_rubro_o_con_celda_chica_usa_sexo_edad_y_estudios():
    # Electricidad y gas, 18-24 tiene 13 observaciones y no trae mediana: se sube a sexo, edad y estudios
    d = gente.sueldo(22, "h", "tecnica", "Electricidad y gas")
    fila = _fila("esi_ingreso_sexo_edad_edu", sexo="hombre", banda_edad="18-24", educacion="tecnica")
    assert d["tabla"] == "esi_ingreso_sexo_edad_edu"
    assert d["cifra"] == round(float(fila["p50"]))
    assert "hombres de 18 a 24 años con estudios técnicos" in d["frase"]


def test_sin_celda_de_tu_edad_usa_todas_las_edades():
    # postgrado a los 18-24 casi no tiene gente en la ESI: se usa 18-54 con esos estudios
    d = gente.sueldo(20, "m", "postgrado")
    fila = _fila("esi_ingreso_sexo_edad_edu", sexo="todos", banda_edad="18-54", educacion="postgrado")
    assert d["cifra"] == round(float(fila["p50"]))
    assert d["n"] >= gente.MIN_N


def test_cambio_de_pega_y_cesantia_son_las_tasas_de_la_eps():
    datos = _por_clave(gente.datos(35, "m", "universitaria"))
    terminos = _fila("eps_terminos_empleo", periodo="2016_2024", banda="30-44")
    assert datos["cambio_de_pega"]["cifra"] == round(float(terminos["cambio_empleador_directo"]) * 100)
    assert f"{round(float(terminos['pasa_a_cesantia']) * 100)} pasan a la cesantía" in datos["cambio_de_pega"]["frase"]
    duracion = _fila("eps_cesantia_duracion", banda="30-44")
    assert datos["cesantia"]["cifra"] == round(float(duracion["mediana_meses"]))
    assert f"{round(float(duracion['sigue_12m']) * 100)} de cada 100" in datos["cesantia"]["frase"]
    for d in datos.values():
        if d["tabla"].startswith("eps"):
            assert "Encuesta de Protección Social" in d["fuente"]


def test_quien_busca_pega_ve_primero_la_cesantia():
    assert gente.datos(30, "m", "universitaria", estado="buscando")[0]["clave"] == "cesantia"
    assert gente.datos(30, "m", "universitaria")[0]["clave"] == "sueldo"


def test_api_post_devuelve_hasta_3_datos_con_fuente(client):
    perfil = {"edad": 31, "sexo": "m", "edu": "universitaria", "rubro": "Servicios profesionales"}
    r = client.post("/api/juego/gente-como-tu", json={"perfil": perfil})
    assert r.status_code == 200, r.text
    datos = r.json()["datos"]
    assert 1 <= len(datos) <= 3
    assert {d["clave"] for d in datos} == {"sueldo", "cambio_de_pega", "cesantia"}
    for d in datos:
        assert d["fuente"] and d["frase"] and d["n"] > 0
        assert isinstance(d["cifra"], int)


def test_api_get_da_lo_mismo_que_el_post(client):
    perfil = {"edad": 27, "sexo": "h", "edu": "tecnica", "rubro": "Construcción"}
    post = client.post("/api/juego/gente-como-tu", json={"perfil": perfil}).json()
    get = client.get("/api/juego/gente-como-tu", params=perfil).json()
    assert get == post


def test_api_get_valida_el_perfil(client):
    assert client.get("/api/juego/gente-como-tu", params={"edu": "doctorado"}).status_code == 422
    assert client.get("/api/juego/gente-como-tu", params={"edad": 12}).status_code == 422
