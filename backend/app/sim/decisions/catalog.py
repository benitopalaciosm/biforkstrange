"""Catálogo de decisiones. Valores de relleno: calibrar con datos reales."""

import numpy as np

from app.sim.decisions.base import Decision
from app.sim.state import State


class ParametricDecision(Decision):
    """Decisión definida por (crecimiento, riesgo de desempleo, desgaste)."""

    growth: float = 0.0
    unemployment_risk: float = 0.05
    wear: float = 0.0

    def apply(self, state: State, rng: np.random.Generator) -> State:
        n = state.sueldo.shape[0]
        # el desgaste alto sube el riesgo de caída
        p = np.clip(self.unemployment_risk + 0.3 * np.maximum(state.desgaste - 0.6, 0), 0, 1)
        state.desempleado = rng.random(n) < p
        shock = rng.normal(self.growth, 0.06, n)
        state.sueldo = np.where(state.desempleado, state.sueldo * 0.6, state.sueldo * (1 + shock))
        state.desgaste = np.clip(state.desgaste + self.wear + rng.normal(0, 0.03, n), 0, 1)
        return state


class Seguir(ParametricDecision):
    key, label = "seguir", "Seguir igual"
    growth, unemployment_risk, wear = 0.03, 0.05, 0.02


class Sabatico(ParametricDecision):
    key, label = "sabatico", "Año sabático"
    growth, unemployment_risk, wear = -0.10, 0.10, -0.15


class CambiarPega(ParametricDecision):
    key, label = "cambiar_pega", "Cambiar de pega"
    growth, unemployment_risk, wear = 0.08, 0.08, 0.05


class TrabajarMas(ParametricDecision):
    key, label = "trabajar_mas", "Trabajar más horas"
    growth, unemployment_risk, wear = 0.05, 0.04, 0.12


class Estudiar(ParametricDecision):
    key, label = "estudiar", "Estudiar"
    growth, unemployment_risk, wear = -0.05, 0.03, 0.04
