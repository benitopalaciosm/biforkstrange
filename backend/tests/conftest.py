import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_simulation_repo
from app.main import app
from app.repositories.simulations import InMemorySimulationRepository


@pytest.fixture
def client():
    repo = InMemorySimulationRepository()  # una instancia por test, compartida entre requests
    app.dependency_overrides[get_simulation_repo] = lambda: repo
    yield TestClient(app)
    app.dependency_overrides.clear()
