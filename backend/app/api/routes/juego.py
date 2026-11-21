"""El juego sobre el motor del paquete. Sin estado: cada llamada trae la partida completa
(perfil, semilla, duda y elecciones) y el servidor la vuelve a jugar."""

from datetime import date

from fastapi import APIRouter, HTTPException

from app.schemas.juego import DudasIn, PartidaIn, TextoPerfilIn
from app.services import perfil_ia
from app.sim.motor import partida
from app.sim.motor.paquete import paquete
from app.sim.motor.perfil import NIVELES

router = APIRouter(prefix="/juego", tags=["juego"])


@router.get("/catalogo")
def catalogo():
    """Alternativas para llenar el perfil."""
    pq = paquete()
    ocupaciones = {int(f["origen"]): f["origen_nombre"] for f in pq.filas("jobhop_transiciones")}
    return {
        "rubros": [r for r in pq.variables["rubro"]["dominio"] if r],
        "tipos_empleador": pq.variables["tipo_empleador"]["dominio"][:-1],
        "niveles": [{"nivel": i, "nombre": n} for i, n in enumerate(NIVELES)],
        "educacion": pq.variables["edu"]["dominio"],
        "ocupaciones": [{"grupo": g, "nombre": n} for g, n in sorted(ocupaciones.items())],
        "carreras": [
            {"carrera_id": int(f["carrera_id"]), "carrera": f["carrera"], "tipo_institucion": f["tipo_institucion"],
             "area": f["area"]}
            for f in pq.filas("mifuturo_carreras")
        ],
    }


@router.post("/dudas")
def dudas(body: DudasIn):
    """Decisiones del banco que esta persona puede elegir como su duda inicial."""
    return partida.dudas_posibles(body.perfil.a_perfil())


@router.post("/partida")
def jugar(body: PartidaIn):
    """Estado de la partida: historia, decisión pendiente con lo que vivieron los gemelos, o el cierre."""
    try:
        return partida.vista(
            body.perfil.a_perfil(), body.semilla, body.duda,
            [e.model_dump() for e in body.elecciones], body.gemelos, body.parametros,
        )
    except (ValueError, KeyError) as error:
        raise HTTPException(422, str(error)) from error


@router.get("/prompt")
def prompt_perfil():
    """El prompt que la persona le pega a su propio Claude para que le arme su documento de perfil."""
    from app.services.perfil_doc import prompt

    return {"prompt": prompt()}


@router.post("/perfil")
def perfil_desde_texto(body: TextoPerfilIn):
    """Claude lee el texto de la persona y llena el perfil para que ella lo revise.

    Devuelve el perfil, qué campos quedaron con un valor por defecto (`supuestos`) y qué dedujo
    Claude sin que estuviera literal (`inferido`). Con 503, el cliente muestra el formulario a mano.
    """
    try:
        return perfil_ia.perfil_desde_texto(body.texto, date.today().isoformat())
    except perfil_ia.ModeloNoDisponible as error:
        raise HTTPException(503, str(error)) from error
    except ValueError as error:
        raise HTTPException(422, str(error)) from error
