"""El compilador de expresiones debe dar lo mismo que el evaluador de referencia del paquete."""

import random
import sys

import pytest

from app.sim.catalogo import catalogo
from app.sim.gemelo import estado_inicial
from app.sim.paquete import RAIZ, ErrorExpresion, paquete_base

sys.path.insert(0, str(RAIZ / "referencia"))
from expresiones import Paquete as Referencia  # noqa: E402


def _expresiones(pq) -> list[str]:
    out = set()

    def resultados(rs):
        for r in rs:
            out.add(r["prob"])
            for ef in r["efectos"]:
                out.add(ef["valor"])
                out.add(ef.get("cuando"))

    for d in pq.decisiones.values():
        out.update([d["cuando"], d["aparicion"]["peso"]])
        for o in d["opciones"]:
            out.add(o.get("requisito"))
            resultados(o["resultados"])
    for e in pq.eventos.values():
        out.update([e["cuando"], e["prob_anual"]])
        resultados(e["resultados"])
    return sorted(x for x in out if isinstance(x, str) and x != "resto")


def test_paridad_con_la_referencia(perfil):
    pq, ref = paquete_base(), Referencia(str(RAIZ))
    cat = catalogo("estable_parecido")
    exprs = _expresiones(pq)
    assert len(exprs) > 150
    r = random.Random(1)
    iguales = 0
    for edad, edu, estado in [(27, "universitaria", "empleado"), (41, "media", "empleado"), (33, "tecnica", "buscando"), (48, "postgrado", "empleado")]:
        e = estado_inicial(cat, {**perfil, "edad": edad, "edu": edu, "estado": estado, "carrera_id": 30})
        e.update(rubro_destino="Minería", region_destino="Valparaíso", ocupacion_destino=2, quien_enferma="madre", prob_ascenso=0.05)
        for x in exprs:
            s = r.randint(0, 10**9)
            try:
                esperado = ref.evaluar(x, e, random.Random(s))
            except Exception:  # noqa: BLE001 - la referencia falla en celdas vacías; el nuestro debe fallar igual
                with pytest.raises(ErrorExpresion):
                    pq.evaluar(x, e, random.Random(s))
                continue
            assert pq.evaluar(x, e, random.Random(s)) == pytest.approx(esperado), x
            iguales += 1
    assert iguales > 600


def test_rechaza_sintaxis_fuera_de_la_gramatica():
    pq = paquete_base()
    for mala in ["__import__('os')", "edad if edad else 0", "[1, 2]", "1 < edad < 3", "edad.real", 'k("USD")']:
        with pytest.raises(ErrorExpresion):
            pq.compilar(mala)


def test_un_mundo_cambia_parametros_sin_tocar_la_base():
    base = paquete_base()
    volatil = catalogo("volatil_parecido").paquete
    assert base.k("P_RECESION") == 0.12
    assert volatil.k("P_RECESION") == 0.22
    assert volatil.k("P_SEPARACION", "30-44") == base.k("P_SEPARACION", "30-44")
