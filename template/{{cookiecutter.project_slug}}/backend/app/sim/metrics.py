"""Resúmenes del estado por año. Agregar métricas aquí sin tocar el motor."""

import numpy as np

from app.sim.state import State


def summarize(state: State) -> dict[str, float]:
    p10, p50, p90 = np.percentile(state.sueldo, [10, 50, 90])
    return {
        "sueldo_p10": float(p10),
        "sueldo_p50": float(p50),
        "sueldo_p90": float(p90),
        "desgaste_p50": float(np.median(state.desgaste)),
        "prob_desempleo": float(state.desempleado.mean()),
    }
