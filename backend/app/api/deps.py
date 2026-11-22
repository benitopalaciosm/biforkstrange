"""Inyección de dependencias: único lugar donde se decide qué implementación usar."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.core.config import get_settings
from app.repositories.simulations import (
    InMemorySimulationRepository,
    SimulationRepository,
    SupabaseSimulationRepository,
)
from app.repositories.twin_profiles import (
    InMemoryTwinProfileRepository,
    SupabaseTwinProfileRepository,
    TwinProfileRepository,
)
from app.services.simulation_service import SimulationService
from app.services.twin_brain import Brain, ClaudeBrain, OfflineBrain
from app.services.twin_service import TwinService


@lru_cache
def get_simulation_repo() -> SimulationRepository:
    if get_settings().supabase_enabled:
        from app.core.supabase import get_supabase

        return SupabaseSimulationRepository(get_supabase())
    return InMemorySimulationRepository()


def get_simulation_service(
    repo: Annotated[SimulationRepository, Depends(get_simulation_repo)],
) -> SimulationService:
    return SimulationService(repo, get_settings().default_runs)


SimulationServiceDep = Annotated[SimulationService, Depends(get_simulation_service)]


@lru_cache
def get_twin_repo() -> TwinProfileRepository:
    if get_settings().supabase_enabled:
        from app.core.supabase import get_supabase

        return SupabaseTwinProfileRepository(get_supabase())
    return InMemoryTwinProfileRepository()


@lru_cache
def get_twin_brain() -> Brain:
    if get_settings().llm_enabled:
        from app.core.llm import get_claude

        return ClaudeBrain(get_claude())
    return OfflineBrain()  # sin ANTHROPIC_API_KEY: preguntas de prueba, sin costo


def get_twin_service(
    repo: Annotated[TwinProfileRepository, Depends(get_twin_repo)],
    brain: Annotated[Brain, Depends(get_twin_brain)],
) -> TwinService:
    return TwinService(repo, brain)


TwinServiceDep = Annotated[TwinService, Depends(get_twin_service)]
