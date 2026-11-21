import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "BiforkStrange"
    supabase_url: str = ""
    supabase_service_key: str = ""
    cors_origins: list[str] = ["http://localhost:5173"]
    default_runs: int = 400  # vidas por camino y por mundo en una comparación

    # Claude: lee el CV y narra. Sin credenciales el juego funciona igual, con plantillas.
    anthropic_api_key: str = ""
    claude_modelo_cv: str = "claude-sonnet-5-5"
    claude_modelo_narracion: str = "claude-haiku-5-5"
    # En local, sin key: Claude Code en modo headless (`claude -p`) con la sesión de quien desarrolla.
    claude_cli: bool = True
    claude_cli_modelo: str = "sonnet"

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_key)

    @property
    def claude_enabled(self) -> bool:
        return bool(self.anthropic_api_key or os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))


@lru_cache
def get_settings() -> Settings:
    return Settings()
