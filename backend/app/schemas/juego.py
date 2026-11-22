from typing import Literal

from pydantic import BaseModel, Field

from app.sim.motor.perfil import Perfil


class PerfilIn(BaseModel):
    """Los 9 campos que declara la persona (más opcionales)."""

    edad: int = Field(30, ge=18, le=50)
    sexo: Literal["h", "m"] = "m"
    edu: Literal["media", "tecnica", "universitaria", "postgrado"] = "universitaria"
    carrera_id: int = Field(-1, ge=-1, le=251)
    rubro: str = "Servicios profesionales"
    tipo_empleador: Literal["grande", "pyme", "startup", "publico", "extranjero"] = "pyme"
    nivel: int = Field(1, ge=0, le=4)
    sueldo: float = Field(1_400_000, gt=0, le=30_000_000)
    riesgo: int = Field(5, ge=0, le=10)
    ocupacion: int | None = Field(None, ge=0, le=9)
    antiguedad: int = Field(2, ge=0, le=40)
    region: Literal["rm", "otra"] = "rm"
    ahorro: float | None = None

    def a_perfil(self) -> Perfil:
        return Perfil(**self.model_dump())


class EleccionIn(BaseModel):
    decision: str | None = None
    opcion: str
    parametros: dict[str, str | int] = {}


class PartidaIn(BaseModel):
    perfil: PerfilIn = PerfilIn()
    semilla: int = 0
    duda: str | None = None
    elecciones: list[EleccionIn] = Field(default_factory=list, max_length=200)
    gemelos: int = Field(100, ge=0, le=2000)
    # lo que se elige dentro de cada opción de la decisión pendiente, para comparar: {opción: {variable: valor}}
    parametros: dict[str, dict[str, str | int]] = {}


class MundoIn(PartidaIn):
    """La partida y cuál de sus mundos se quiere ver (0 a `gemelos` - 1)."""

    mundo: int = Field(ge=0, le=1999)


class DudasIn(BaseModel):
    perfil: PerfilIn = PerfilIn()


class TextoPerfilIn(BaseModel):
    """Lo que la persona escribe o sube sobre sí misma (markdown, currículum pegado, un párrafo)."""

    texto: str = Field(min_length=1, max_length=60_000)
