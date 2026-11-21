"""Motor Monte Carlo: aplica decisiones año a año sobre n_runs universos."""

import numpy as np

from app.sim.decisions import get_decision
from app.sim.metrics import summarize
from app.sim.state import State, Twin


def simulate(twin: Twin, decisions: list[str], n_runs: int = 2000, seed: int | None = None) -> dict:
    rng = np.random.default_rng(seed)
    state = State.from_twin(twin, n_runs)
    trajectory = []
    for key in decisions:
        state = get_decision(key).apply(state, rng)
        state.edad += 1
        trajectory.append({"decision": key, "edad": state.edad, **summarize(state)})
    return {"edad_final": state.edad, "trayectoria": trajectory}
