from fastapi import APIRouter, Form, HTTPException, UploadFile

from app.api.deps import ClaudeServiceDep, JuegoServiceDep
from app.schemas.juego import CaminosIn, ComparacionIn, EpilogoIn, GemeloIn, GemeloLeido, HistoriaIn, SuerteIn, TurnoIn
from app.services import transparencia
from app.services.claude_service import ClaudeNoDisponible
from app.sim.calibracion import calibrar

router = APIRouter(tags=["juego"])

_MAX_CV = 8 * 1024 * 1024


@router.get("/catalogo")
def get_catalogo(claude: ClaudeServiceDep) -> dict:
    """Opciones del formulario del gemelo y mundos disponibles."""
    return transparencia.catalogo_formulario(claude.disponible, claude.transporte)


@router.post("/gemelo")
def crear_gemelo(body: GemeloIn, service: JuegoServiceDep) -> dict:
    """Valida el perfil y devuelve el punto de partida: gente como tú y bifurcaciones posibles."""
    return service.crear_gemelo(body)


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
    """Recalcula la partida con las elecciones dadas y devuelve la siguiente decisión, o el final."""
    return service.turno(body)


@router.post("/caminos")
def caminos(body: CaminosIn, service: JuegoServiceDep, claude: ClaudeServiceDep) -> dict:
    """Los caminos del primer año como cartas: 4 elegidos para la persona (por Claude si está), con efectos y contexto real."""
    return service.caminos(body, claude)


@router.post("/suerte")
def suerte(body: SuerteIn, service: JuegoServiceDep) -> dict:
    """Percentil de tu carrera entre muchas vidas con tu mismo punto de partida y mundo."""
    return service.suerte(body)


@router.post("/historia")
def historia(body: HistoriaIn, claude: ClaudeServiceDep) -> dict:
    """Claude narra el año que cerró y escribe la próxima decisión a la medida. Campos en null si no hay Claude."""
    out = claude.historia(body)
    return out.model_dump() if out else {"anio": None, "caso": None}


@router.post("/epilogo")
def epilogo(body: EpilogoIn, claude: ClaudeServiceDep) -> dict:
    """Cierre de la vida: la década contada de corrido y el CV final. `epilogo` es null si no hay Claude."""
    out = claude.epilogo(body)
    return {"epilogo": out.model_dump() if out else None}


@router.post("/comparaciones")
def comparar(body: ComparacionIn, service: JuegoServiceDep) -> dict:
    """Corre los dos caminos de la bifurcación en los cuatro mundos, con los mismos dados."""
    return service.comparar(body)


@router.get("/comparaciones/{cid}")
def obtener_comparacion(cid: str, service: JuegoServiceDep) -> dict:
    out = service.obtener_comparacion(cid)
    if out is None:
        raise HTTPException(404, "Comparación no encontrada")
    return out


@router.get("/calibracion")
def calibracion() -> dict:
    """Cohorte simulada contra los objetivos del paquete (ESI y EPS)."""
    return calibrar()


@router.get("/fuentes")
def fuentes() -> dict:
    """Parámetros con su fuente y calidad, y los supuestos que agrega el juego."""
    return transparencia.fuentes()
