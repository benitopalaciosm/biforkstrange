"""Hallazgos de la revisión M5 que se corrigieron: quedan como tests de regresión.

Los pendientes estaban marcados `xfail` y se sacaron para acelerar la suite; la lista está en
docs/motor/TICKETS.md (M12). El detalle está en el informe M5.
"""

import pytest
from _motor_util import NADA, DadosGuion, Guion, vida

from app.sim.motor import gemelos
from app.sim.motor.azar import Dados
from app.sim.motor.perfil import Perfil

QUIETA = {"oferta_externa": "quedarse"}
CESANTE = Perfil(edad=30, estado="buscando", sueldo=1_000_000)


# ------------------------------------------------------------------ errores del año y del cierre
def test_quien_vuelve_del_trabajo_por_cuenta_propia_no_queda_empleado_con_sueldo_cero():
    """Corregido durante la revisión (era el error más grave: 13% de la cohorte terminaba empleada con
    sueldo 0). Quien nunca fue empleado y deja el trabajo por cuenta propia no tiene sueldo de
    referencia: ahora busca como primera pega en vez de cobrar sueldo_ref (0) x azar para siempre."""
    d = DadosGuion({"independiente:vuelve": 0.0, "dec:cesantia:rapido": 0.0, "dec:tipo_de_empleador:sorteo": 0.5,
                    (1, "dec:primera_pega:pyme"): 0.0})
    v = vida(Perfil.a_los_18(), d)
    guion = Guion({"salir_del_colegio": "trabajar", "primera_pega": ["independiente", "pyme"], "cesantia": "rapido",
                   **QUIETA})
    v.vivir_anio(guion)
    assert v.e["estado"] == "buscando" and v.registro is None  # trabajó por su cuenta y ese año lo dejó
    v.vivir_anio(guion)
    assert v.e["estado"] == "empleado"
    assert v.e["sueldo"] > 0


def test_bootcamp_desde_la_cesantia_no_revienta_el_anio():
    """Corregido durante la revisión. bootcamp/colocado dejaba 'empleado' sin tipo de empleador a quien
    nunca tuvo uno y el evento separacion_empleo reventaba (clave '' no está en MULT_DESPIDO_TIPO)."""
    d = DadosGuion({"dec:bootcamp:hacer": 0.0})
    v = vida(CESANTE, d)
    v.vivir_anio(Guion({"cesantia": "bootcamp", "bootcamp": "hacer", **QUIETA}))
    assert v.e["estado"] == "empleado" and v.e["tipo_empleador"] != ""


def test_dos_ofertas_en_el_mismo_anio_se_sortean_por_separado():
    pares = []
    for g in range(400):
        v = vida(Perfil(edad=24), DadosGuion({"evento:oferta_llega": 0.0, "evento:separacion_empleo": NADA},
                                             defecto=0.5, semilla=6, gemelo=g))
        v.dados.u = lambda anio, sitio, _d=v.dados: _d.guion.get(sitio, Dados(6, _d._reales.gemelo).u(anio, sitio))
        reg = v.vivir_anio(Guion({"oferta_externa": "cambiar"}, con_cartas=True), carta="oferta_externa")
        ofertas = [x["resultado"] for x in reg["decisiones"] if x["decision"] == "oferta_externa"]
        assert len(ofertas) == 2
        pares.append(ofertas[0] == ofertas[1])
    # independientes coincidirían cerca de la mitad de las veces (0,54² + 0,46²)
    assert sum(pares) < 0.6 * len(pares)


def test_terminar_el_doctorado_conserva_el_premio_en_el_sueldo_de_referencia():
    """Corregido durante la revisión: al quedar 'buscando' con sueldo, el motor pisaba sueldo_ref y
    borraba el premio del doctorado (x 1,13) que el mismo resultado acababa de aplicar."""
    v = vida(Perfil(edad=30, sueldo=1_000_000), DadosGuion({"dec:doctorado:ir": 0.0}))
    v.vivir_anio(Guion({"doctorado": "ir"}), carta="doctorado")
    assert v.e["edu"] == "postgrado" and v.e["estado"] == "buscando" and v.e["sueldo"] == 0
    assert v.e["sueldo_ref"] == pytest.approx(1_000_000 * 1.13)


# ------------------------------------------------------------------ efectos con duración
# ------------------------------------------------------------------ alcance completo
# ------------------------------------------------------------------ decisiones con elección interna
# ------------------------------------------------------------------ gemelos y políticas
def test_comparar_no_cuenta_dos_veces_al_gemelo_que_ya_no_tiene_historia():
    """Guardia: la comparación tolera vidas que terminan antes (60 años)."""
    v = vida(Perfil(edad=50, nivel=2), Dados(0, "tu"))
    c = gemelos.comparar(v, "pedir_aumento", n=10, anios=10, semilla=1)
    assert all(len(o["trayectoria"]) == 10 for o in c["opciones"])


