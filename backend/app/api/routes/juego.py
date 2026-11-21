from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.api.deps import ClaudeServiceDep, JuegoServiceDep
from app.schemas.juego import EpilogoIn, GemeloIn, GemeloLeido, HistoriaIn, SuerteIn, TurnoIn
from app.services.claude_service import ClaudeNoDisponible
from app.services.juego_service import catalogo_formulario
from app.sim.calibracion import calibrar

router = APIRouter(tags=["juego"])

_MAX_CV = 8 * 1024 * 1024


@router.get("/catalogo")
def get_catalogo(claude: ClaudeServiceDep) -> dict:
    """Opciones del formulario, mundos y si Claude está disponible."""
    return catalogo_formulario(claude.disponible, claude.transporte)


@router.post("/gemelo")
def validar_gemelo(body: GemeloIn, service: JuegoServiceDep) -> dict:
    """Valida el perfil y devuelve cómo parte el gemelo."""
    return service.validar_gemelo(body.perfil, body.prioridades)


@router.post("/gemelo/leer", response_model=GemeloLeido)
async def leer_gemelo(claude: ClaudeServiceDep, archivo: UploadFile | None = None, sobre_ti: str = Form("", max_length=20_000)) -> GemeloLeido:
    """Claude arma el gemelo desde el CV (PDF o texto) y lo que la persona cuenta de sí: perfil, identidad y cómo decide."""
    contenido = await archivo.read() if archivo is not None else b""
    if not contenido and not sobre_ti.strip():
        raise HTTPException(422, "Sube tu CV o cuéntanos algo de ti.")
    if len(contenido) > _MAX_CV:
        raise HTTPException(413, "El archivo pesa más de 8 MB.")
    es_pdf = contenido[:5] == b"%PDF-"
    if contenido and not es_pdf and (archivo.content_type or "").split("/")[0] not in ("text", ""):
        raise HTTPException(415, "Sube un PDF o un archivo de texto.")
    try:
        return claude.leer_gemelo(contenido or None, es_pdf, sobre_ti)
    except ClaudeNoDisponible as x:
        raise HTTPException(503, str(x)) from x


@router.post("/partidas/turno")
def turno(body: TurnoIn, service: JuegoServiceDep) -> dict:
    """Recalcula la carrera con las elecciones dadas y devuelve la próxima temporada, o el final."""
    return service.turno(body)


@router.post("/suerte")
def suerte(body: SuerteIn, service: JuegoServiceDep) -> dict:
    """Percentil de tu carrera entre muchas vidas con tu mismo punto de partida y mundo."""
    return service.suerte(body)


@router.post("/historia")
def historia(body: HistoriaIn, claude: ClaudeServiceDep) -> dict:
    """Claude cuenta el año que cerró y titula la temporada que viene. Campos en null si no hay Claude."""
    out = claude.historia(body)
    return out.model_dump() if out else {"anio": None, "caso": None}


@router.post("/epilogo")
def epilogo(body: EpilogoIn, claude: ClaudeServiceDep) -> dict:
    """Cierre de la carrera: la década contada y el CV final. `epilogo` es null si no hay Claude."""
    out = claude.epilogo(body)
    return {"epilogo": out.model_dump() if out else None}


@router.get("/calibracion")
def calibracion() -> dict:
    """Cohorte simulada contra los objetivos del paquete (ESI y EPS)."""
    return calibrar()
