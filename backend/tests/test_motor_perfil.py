"""Del perfil al estado inicial (`perfil.py`): lo declarado y los supuestos escritos en TICKETS.md."""

import pytest
from _motor_util import pq

from app.sim.motor.perfil import Perfil, estado_inicial


def _e(**perfil):
    return estado_inicial(Perfil(**perfil), pq())


def test_lo_declarado_pasa_tal_cual():
    e = _e(edad=41, sexo="h", edu="tecnica", rubro="Salud", tipo_empleador="grande", nivel=2, sueldo=1_234_567,
           riesgo=7, antiguedad=6, region="otra")
    assert (e["edad"], e["sexo"], e["edu"], e["rubro"], e["tipo_empleador"], e["nivel"]) == (
        41, "h", "tecnica", "Salud", "grande", 2)
    assert (e["sueldo"], e["sueldo_ref"], e["antiguedad"], e["region"], e["estado"]) == (
        1_234_567, 1_234_567, 6, "otra", "empleado")
    assert e["riesgo"] == 70  # de 0-10 a la escala 0-100 del paquete
    assert e["primer_empleo"] == 0 and e["anos_titulado"] == 41 - 21


def test_supuestos_de_lo_que_la_persona_no_declara():
    """TICKETS.md: contactos 30, oficio 50, ahorro de dos sueldos, sin pareja ni hijos."""
    e = _e(sueldo=1_400_000)
    assert (e["red"], e["skill"], e["pareja"], e["hijos"], e["edad_hijo_menor"]) == (30, 50, "no", 0, -1)
    assert e["ahorro"] == 2 * 1_400_000
    assert _e(ahorro=123.0)["ahorro"] == 123.0
    assert (e["animo"], e["energia"], e["horas"], e["formal"], e["pais"], e["salud"]) == (64, 70, 44, 1, "chile", "bien")
    assert (e["p_encontrar"], e["p_renuncia"], e["aprendizaje"], e["deja_de_trabajar"], e["recesion"]) == (1, 1, 1, 0, 0)
    assert e["madre_edad"] in (30 + 28, 30 + 29) and e["padre_edad"] > e["madre_edad"]
    assert set(pq().variables) - set(e) == {v for v, d in pq().variables.items() if d["inicio"] == "deriva"}


@pytest.mark.parametrize(("sueldo", "tasa"), [(400_000, 0.03), (1_400_000, 0.08), (9_000_000, 0.195)])
def test_la_tasa_de_ahorro_inicial_sale_del_percentil(sueldo, tasa):
    """TASA_AHORRO literal: 3% bajo la mediana, 8% entre p50 y p79, 19,5% desde p80."""
    assert _e(sueldo=sueldo)["tasa_ahorro"] == tasa


def test_quien_no_trabaja_parte_sin_sueldo_pero_recuerda_el_ultimo():
    e = _e(estado="buscando", sueldo=1_000_000)
    assert (e["sueldo"], e["sueldo_ref"], e["primer_empleo"], e["tipo_empleador"], e["antiguedad"]) == (
        0, 1_000_000, 0, "", 0)
    assert _e(estado="buscando", sueldo=0)["primer_empleo"] == 1
    joven = estado_inicial(Perfil.a_los_18(), pq())
    assert (joven["edad"], joven["estado"], joven["edu"], joven["carrera_id"], joven["sueldo"]) == (
        18, "estudiando", "media", -1, 0)
    assert joven["anos_titulado"] == 0 and joven["primer_empleo"] == 1


def test_la_carrera_trae_su_area_y_tipo_de_institucion():
    fila = pq().filas("mifuturo_carreras")[57]
    e = _e(carrera_id=int(fila["carrera_id"]))
    assert (e["area"], e["tipo_institucion"]) == (fila["area"], fila["tipo_institucion"])
    assert (_e()["area"], _e()["tipo_institucion"]) == ("", "")
