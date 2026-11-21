"""Persistencia detrás de una interfaz: el servicio no sabe si es Supabase o memoria."""

import uuid
from typing import Protocol

from supabase import Client


class SimulationRepository(Protocol):
    def save(self, input: dict, result: dict, user_id: str | None = None) -> str: ...
    def get(self, sim_id: str) -> dict | None: ...


class SupabaseSimulationRepository:
    table = "simulations"

    def __init__(self, client: Client):
        self.client = client

    def save(self, input: dict, result: dict, user_id: str | None = None) -> str:
        row = {"input": input, "result": result, "user_id": user_id}
        return self.client.table(self.table).insert(row).execute().data[0]["id"]

    def get(self, sim_id: str) -> dict | None:
        data = self.client.table(self.table).select("*").eq("id", sim_id).limit(1).execute().data
        return data[0] if data else None


class InMemorySimulationRepository:
    """Para desarrollo local y tests, sin credenciales."""

    def __init__(self):
        self._rows: dict[str, dict] = {}

    def save(self, input: dict, result: dict, user_id: str | None = None) -> str:
        sim_id = str(uuid.uuid4())
        self._rows[sim_id] = {"id": sim_id, "input": input, "result": result, "user_id": user_id}
        return sim_id

    def get(self, sim_id: str) -> dict | None:
        return self._rows.get(sim_id)
