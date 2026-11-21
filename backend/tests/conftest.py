import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_simulation_repo
from app.main import app
from app.repositories.simulations import InMemorySimulationRepository

PERFIL = {
    "edad": 27, "sexo": "h", "edu": "universitaria", "area": "Administración y Comercio", "estado": "empleado",
    "tipo_empleador": "pyme", "rubro": "Finanzas y seguros", "nivel": 1, "sueldo": 1_800_000, "antiguedad": 2,
    "ahorro": 3_000_000, "riesgo": 4,
}
PRIORIDADES = {"dinero": 40, "vida_personal": 30, "carrera": 20, "bienestar": 10}


@pytest.fixture
def client():
    repo = InMemorySimulationRepository()  # una instancia por test, compartida entre requests
    app.dependency_overrides[get_simulation_repo] = lambda: repo
    yield TestClient(app)
    app.dependency_overrides.clear()


@pytest.fixture
def perfil():
    return dict(PERFIL)


@pytest.fixture
def prioridades():
    return dict(PRIORIDADES)
