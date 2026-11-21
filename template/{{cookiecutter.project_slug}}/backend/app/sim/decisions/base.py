from abc import ABC, abstractmethod
from typing import ClassVar

import numpy as np

from app.sim.state import State

_REGISTRY: dict[str, "Decision"] = {}


class Decision(ABC):
    """Una decisión transforma el estado de un año. Para agregar una nueva,
    crea una subclase con `key` y `label` en catalog.py (o en otro módulo
    importado allí): se registra sola y aparece en la API."""

    key: ClassVar[str]
    label: ClassVar[str]
    description: ClassVar[str] = ""

    def __init_subclass__(cls, **kw):
        super().__init_subclass__(**kw)
        if getattr(cls, "key", None):
            _REGISTRY[cls.key] = cls()

    @abstractmethod
    def apply(self, state: State, rng: np.random.Generator) -> State: ...


def get_decision(key: str) -> Decision:
    try:
        return _REGISTRY[key]
    except KeyError as e:
        raise ValueError(f"Decisión desconocida: {key}") from e


def all_decisions() -> list[Decision]:
    return list(_REGISTRY.values())
