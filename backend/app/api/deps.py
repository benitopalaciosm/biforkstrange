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
from app.services.claude_service import ClaudeService
from app.services.juego_service import JuegoService


@lru_cache
def get_simulation_repo() -> SimulationRepository:
    if get_settings().supabase_enabled:
        from app.core.supabase import get_supabase

        return SupabaseSimulationRepository(get_supabase())
    return InMemorySimulationRepository()


def get_juego_service(
    repo: Annotated[SimulationRepository, Depends(get_simulation_repo)],
) -> JuegoService:
    return JuegoService(repo, get_settings().default_runs)


@lru_cache
def get_claude_service() -> ClaudeService:
    from app.core.llm import get_llm

    return ClaudeService(get_llm())


JuegoServiceDep = Annotated[JuegoService, Depends(get_juego_service)]
ClaudeServiceDep = Annotated[ClaudeService, Depends(get_claude_service)]
