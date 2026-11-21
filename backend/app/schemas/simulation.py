from pydantic import BaseModel, Field


class TwinIn(BaseModel):
    edad: int = Field(25, ge=18, le=50)
    sueldo: float = Field(900_000, gt=0)
    desgaste: float = Field(0.2, ge=0, le=1)
    ocupacion: int = Field(2, ge=0, le=9, description="Grupo ISCO a 1 dígito; ver GET /api/ocupaciones")
    antiguedad: float = Field(0, ge=0, le=50)


class SimulationIn(BaseModel):
    twin: TwinIn = TwinIn()
    decisiones: list[str] = Field(min_length=1, max_length=32)
    n_runs: int | None = Field(None, ge=100, le=20_000)
    seed: int | None = None


class OcupacionOut(BaseModel):
    grupo: int
    nombre: str


class OcupacionProb(OcupacionOut):
    prob: float


class Step(BaseModel):
    decision: str
    edad: int
    sueldo_p10: float
    sueldo_p50: float
    sueldo_p90: float
    desgaste_p50: float
    prob_desempleo: float
    # defaults para leer corridas guardadas antes de que existieran estos campos
    prob_nuevo_empleo: float = 0
    prob_cambio_grupo: float = 0
    prob_cambio_ocupacion: float = 0
    antiguedad_p50: float = 0
    empleos_p50: float = 0
    ocupaciones: list[OcupacionProb] = []


class SimulationOut(BaseModel):
    id: str | None = None
    edad_final: int
    trayectoria: list[Step]


class DecisionOut(BaseModel):
    key: str
    label: str
    description: str = ""


class TerminoAnual(BaseModel):
    total: float
    cambio_directo: float
    cesantia: float
    inactividad: float


class DuracionAnios(BaseModel):
    p25: float
    p50: float
    p75: float


class PerfilOcupacionOut(OcupacionOut):
    edad: int
    termino_anual: TerminoAnual
    duracion_anios: DuracionAnios
    p_cambia_grupo: float
    p_cambia_ocupacion: float
    siguiente: list[OcupacionProb]
