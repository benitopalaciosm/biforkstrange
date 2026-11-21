from pydantic import BaseModel, Field


class TwinIn(BaseModel):
    edad: int = Field(25, ge=18, le=50)
    sueldo: float = Field(900_000, gt=0)
    desgaste: float = Field(0.2, ge=0, le=1)


class SimulationIn(BaseModel):
    twin: TwinIn = TwinIn()
    decisiones: list[str] = Field(min_length=1, max_length=32)
    n_runs: int | None = Field(None, ge=100, le=20_000)
    seed: int | None = None


class Step(BaseModel):
    decision: str
    edad: int
    sueldo_p10: float
    sueldo_p50: float
    sueldo_p90: float
    desgaste_p50: float
    prob_desempleo: float


class SimulationOut(BaseModel):
    id: str | None = None
    edad_final: int
    trayectoria: list[Step]


class DecisionOut(BaseModel):
    key: str
    label: str
    description: str = ""
