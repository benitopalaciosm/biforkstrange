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
from app.services.simulation_service import SimulationService


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

