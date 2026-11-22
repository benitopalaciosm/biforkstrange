"""Decisiones del modelo que tomó el equipo (ver `docs/motor/TICKETS.md`).

1. El alza anual descuenta el ascenso promedio de la población, no el de la persona: ascender más paga.
"""

import math

import pytest
from _motor_util import n, pq, vida

from app.sim.motor.azar import Dados
from app.sim.motor.perfil import Perfil
from app.sim.motor.politicas import Inercia

# Literales de parametros.json (no se importan del código bajo prueba)
ASCENSO_POBLACION = {"18-24": 0.056, "25-29": 0.061, "30-34": 0.061, "35-39": 0.055, "40-44": 0.05,
                     "45-49": 0.045, "50-54": 0.045}
ALZA_ASCENSO_MEDIA = (0.05 + 0.1) / 2


# ------------------------------------------------------------------ 1. ascender más paga
def _alza(estado: dict, gemelo: int = 0) -> float:
    """El multiplicador de sueldo de alza_anual para un estado, con dados fijos."""
    expr = pq().eventos["alza_anual"]["resultados"][0]["efectos"][0]["valor"]
    return pq().evaluar(expr, estado, Dados(0, gemelo).flujo(0, "evento:alza_anual:alza"))


def test_el_alza_anual_no_depende_de_tu_propia_probabilidad_de_ascenso():
    e = vida(Perfil(edad=35)).e
    for g in range(20):
        assert _alza({**e, "prob_ascenso": 0.0}, g) == _alza({**e, "prob_ascenso": 0.4}, g)


def test_el_alza_anual_descuenta_el_ascenso_promedio_de_su_tramo_de_edad():
    """Sin ruido (todo en su valor central), el alza es el crecimiento ESI menos el ascenso promedio por su alza."""
    e = vida(Perfil(edad=35, tipo_empleador="pyme")).e
    expr = pq().eventos["alza_anual"]["resultados"][0]["efectos"][0]["valor"]
    sin_ruido = expr.replace("si(azar() < 0.9, 0.03 * azar_normal(), -0.05 + 0.08 * azar_normal())", "0")
    assert sin_ruido != expr
    for edad in (27, 35, 47):
        estado = pq().derivar({**e, "edad": edad, "recesion": 0, "anos_titulado": 10})
        # el alza tiene piso cero: en la misma pega el sueldo no baja
        esperado = 1 + max(0, estado["crecimiento_esi"] - ASCENSO_POBLACION[estado["banda7"]] * ALZA_ASCENSO_MEDIA)
        assert pq().evaluar(sin_ruido, estado) == pytest.approx(esperado)


def test_quien_asciende_mas_termina_ganando_mas():
    """Mismos dados, solo cambia el oficio (que sube la probabilidad de ascenso): antes el alza anual
    se lo quitaba entero y en promedio ganaban lo mismo."""
    diferencias, ascensos = [], [0, 0]
    for g in range(n(150)):
        finales = []
        for i, skill in enumerate((30, 80)):
            v = vida(Perfil(), Dados(0, g), skill=skill)
            v.vivir(Inercia(), 10)
            finales.append(v.sueldo_o_ultimo())
            ascensos[i] += sum(1 for a in v.historia for x in a["eventos"] if x["evento"] == "ascenso")
        if min(finales) > 0:
            diferencias.append(math.log(finales[1] / finales[0]))
    assert ascensos[1] > ascensos[0]
    assert sum(diferencias) / len(diferencias) > 0.01
