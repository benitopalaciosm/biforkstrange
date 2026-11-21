"""Acceso a Claude con dos transportes y una sola interfaz.

- `SdkLLM`: la API de Anthropic con el SDK oficial. Se usa si hay `ANTHROPIC_API_KEY`.
- `CliLLM`: Claude Code en modo headless (`claude -p`). Se usa en local cuando no hay key y
  el binario `claude` está instalado: corre con la sesión de quien desarrolla, sin tools.

Todas las llamadas piden salida estructurada contra un modelo Pydantic y devuelven None si
algo falla. Quien llama siempre tiene un respaldo sin Claude.
"""

from __future__ import annotations

import base64
import io
import json
import logging
import shutil
import subprocess
import tempfile
from functools import lru_cache
from typing import Protocol, TypeVar

from pydantic import BaseModel, ValidationError

from app.core.config import get_settings

log = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)


class LLM(Protocol):
    nombre: str

    def pedir(self, *, sistema: str, usuario: str, esquema: type[T], rapido: bool = False, pdf: bytes | None = None, timeout: float = 60) -> T | None: ...


def texto_de_pdf(pdf: bytes, max_paginas: int = 12) -> str:
    from pypdf import PdfReader

    lector = PdfReader(io.BytesIO(pdf))
    return "\n".join((p.extract_text() or "") for p in lector.pages[:max_paginas]).strip()


class SdkLLM:
    nombre = "api"

    def __init__(self, modelo: str, modelo_rapido: str, api_key: str = ""):
        import anthropic

        self._anthropic = anthropic
        self.cliente = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()
        self.modelo, self.modelo_rapido = modelo, modelo_rapido

    def pedir(self, *, sistema, usuario, esquema, rapido=False, pdf=None, timeout=60):
        contenido: list[dict] = [{"type": "text", "text": usuario}]
        if pdf:
            contenido.insert(0, {"type": "document", "source": {"type": "base64", "media_type": "application/pdf", "data": base64.standard_b64encode(pdf).decode()}})
        try:
            r = self.cliente.with_options(timeout=timeout, max_retries=1).messages.parse(
                model=self.modelo_rapido if rapido else self.modelo,
                max_tokens=6000,
                system=sistema,
                output_config={"effort": "low"},
                messages=[{"role": "user", "content": contenido}],
                output_format=esquema,
            )
        except self._anthropic.APIError as x:
            log.warning("Claude (API) falló: %s", x)
            return None
        return None if r.stop_reason == "refusal" else r.parsed_output


class CliLLM:
    nombre = "claude-code"

    def __init__(self, binario: str, modelo: str):
        self.binario, self.modelo = binario, modelo

    def pedir(self, *, sistema, usuario, esquema, rapido=False, pdf=None, timeout=60):
        if pdf:
            try:
                usuario = f"{usuario}\n\n<documento>\n{texto_de_pdf(pdf)}\n</documento>"
            except Exception as x:  # noqa: BLE001 - un PDF ilegible no debe botar la petición
                log.warning("No se pudo leer el PDF: %s", x)
                return None
        cmd = [
            self.binario, "-p", "--model", self.modelo, "--tools", "", "--strict-mcp-config", "--setting-sources", "",
            "--no-session-persistence", "--system-prompt", sistema, "--output-format", "json",
            "--json-schema", json.dumps(esquema.model_json_schema()),
        ]
        try:
            with tempfile.TemporaryDirectory() as cwd:
                p = subprocess.run(cmd, input=usuario, capture_output=True, text=True, timeout=timeout, cwd=cwd)  # noqa: S603
            salida = json.loads(p.stdout)
            if salida.get("is_error") or salida.get("structured_output") is None:
                log.warning("Claude Code no devolvió salida estructurada: %s", str(salida.get("result"))[:200])
                return None
            return esquema.model_validate(salida["structured_output"])
        except (subprocess.TimeoutExpired, json.JSONDecodeError, ValidationError, OSError) as x:
            log.warning("Claude Code falló: %s", x)
            return None


@lru_cache
def get_llm() -> LLM | None:
    s = get_settings()
    if s.claude_enabled:
        return SdkLLM(s.claude_modelo_cv, s.claude_modelo_narracion, s.anthropic_api_key)
    binario = shutil.which("claude") if s.claude_cli else None
    return CliLLM(binario, s.claude_cli_modelo) if binario else None
