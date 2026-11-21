"""Inyección de dependencias: único lugar donde se decide qué implementación usar."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.core.config import get_settings
from app.services.claude_service import ClaudeService
from app.services.juego_service import JuegoService


def get_juego_service() -> JuegoService:
    return JuegoService(get_settings().default_runs)


@lru_cache
def get_claude_service() -> ClaudeService:
    from app.core.llm import get_llm

    return ClaudeService(get_llm())


JuegoServiceDep = Annotated[JuegoService, Depends(get_juego_service)]
ClaudeServiceDep = Annotated[ClaudeService, Depends(get_claude_service)]
