from fastapi import APIRouter, HTTPException, Query

from app.schemas.simulation import OcupacionOut, PerfilOcupacionOut
from app.sim import labor
from app.sim.tables import N_GRUPOS, tablas

router = APIRouter(prefix="/ocupaciones", tags=["ocupaciones"])


@router.get("", response_model=list[OcupacionOut])
def list_ocupaciones():
    return [OcupacionOut(grupo=g, nombre=n) for g, n in enumerate(tablas().nombres)]


@router.get("/{grupo}", response_model=PerfilOcupacionOut)
def perfil_ocupacion(grupo: int, edad: int = Query(25, ge=18, le=59)):
    """Qué pasa después de tu último trabajo, según las tablas (sin simular)."""
    if not 0 <= grupo < N_GRUPOS:
        raise HTTPException(404, "Grupo ocupacional desconocido")
    return labor.perfil(grupo, edad)
