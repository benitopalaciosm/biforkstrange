"""Contratos de la API del juego."""

from typing import Literal

from pydantic import BaseModel, Field, model_validator

Edu = Literal["media", "tecnica", "universitaria", "postgrado"]
TipoEmpleador = Literal["grande", "pyme", "startup", "publico", "extranjero"]


class Perfil(BaseModel):
    """Lo que la persona cuenta de sí misma. El motor completa el resto del estado."""

    edad: int = Field(ge=20, le=50)
    sexo: Literal["h", "m"]
    edu: Edu
    area: str = ""
    carrera_id: int | None = Field(None, ge=0, le=251)
    estado: Literal["empleado", "buscando"] = "empleado"
    tipo_empleador: TipoEmpleador | None = None
    rubro: str = ""
    nivel: int = Field(1, ge=0, le=4)
    sueldo: float = Field(0, ge=0, le=30_000_000, description="Líquido mensual. Si buscas trabajo, tu último sueldo.")
    antiguedad: int = Field(0, ge=0, le=40)
    ahorro: float = Field(0, ge=-100_000_000, le=2_000_000_000)
    pareja: Literal["no", "pololeo", "convive", "casado"] = "no"
    hijos: int = Field(0, ge=0, le=6)
    region: Literal["rm", "otra"] = "rm"
    ingles: bool = False
    usa_ia: bool = False
    remoto: bool = False
    isapre: bool = False
    propietario: bool = False
    riesgo: int = Field(3, ge=1, le=5, description="Tolerancia al riesgo, 1 a 5.")

    @model_validator(mode="after")
    def _coherente(self):
        if self.sueldo <= 0:
            raise ValueError("Falta el sueldo (si buscas trabajo, el último que tuviste).")
        if self.estado == "empleado":
            if not self.tipo_empleador or (not self.rubro and self.tipo_empleador != "publico"):
                raise ValueError("Si trabajas, faltan el tipo de empleador y el rubro.")
        return self


class Prioridades(BaseModel):
    dinero: float = Field(25, ge=0)
    carrera: float = Field(25, ge=0)
    bienestar: float = Field(25, ge=0)
    vida_personal: float = Field(25, ge=0)

    @model_validator(mode="after")
    def _suma(self):
        if self.dinero + self.carrera + self.bienestar + self.vida_personal <= 0:
            raise ValueError("Reparte al menos un punto entre tus prioridades.")
        return self


class GemeloIn(BaseModel):
    perfil: Perfil
    prioridades: Prioridades = Prioridades()


class Propension(BaseModel):
    decision: str = Field(description="Id de la decisión, tal como viene en el catálogo.")
    opcion: str = Field(description="Id de la opción.")
    prob: float = Field(description="Probabilidad de 0 a 1 de que esta persona elija esa opción cuando se le presenta la decisión.")


class Identidad(BaseModel):
    """Quién es el gemelo, según Claude. Viaja con cada petición: el servidor no guarda nada."""

    gemelo_md: str = Field("", max_length=2500)
    rasgos: list[str] = Field(default_factory=list, max_length=8)
    politica: list[Propension] = Field(default_factory=list, max_length=200)
    empresa: str = Field("", max_length=80, description="Nombre del empleador actual, si la persona lo dio.")
    cargo: str = Field("", max_length=80)


class TurnoIn(BaseModel):
    perfil: Perfil
    prioridades: Prioridades = Prioridades()
    identidad: Identidad = Identidad()
    mundo: str
    semilla: int = Field(ge=0, le=2**31)
    bifurcacion: str | None = Field(None, description="Id de la bifurcación de juego.json; la primera elección es su opción.")
    elecciones: list[str] = Field(default_factory=list, max_length=60)


class PartidaJugada(BaseModel):
    mundo: str
    semilla: int = Field(ge=0, le=2**31)
    elecciones: list[str] = Field(max_length=60)


class ComparacionIn(BaseModel):
    perfil: Perfil
    prioridades: Prioridades = Prioridades()
    identidad: Identidad = Identidad()
    bifurcacion: str
    n: int | None = Field(None, ge=50, le=1000)
    semilla: int = Field(2026, ge=0, le=2**31)
    partidas: list[PartidaJugada] = Field(default_factory=list, max_length=12)


class SuerteIn(BaseModel):
    perfil: Perfil
    prioridades: Prioridades = Prioridades()
    identidad: Identidad = Identidad()
    mundo: str
    semilla: int = Field(ge=0, le=2**31)
    n: int | None = Field(None, ge=50, le=1000)
    felicidad: float
    sueldo_final: float
    ingreso_acumulado: float


class HistoriaIn(BaseModel):
    """Lo que el motor ya calculó y Claude debe contar: el año que cerró y la decisión que viene."""

    perfil: Perfil
    identidad: Identidad = Identidad()
    mundo: str = ""
    historia_previa: list[str] = Field(default_factory=list, max_length=12)
    anio: dict | None = None
    pendiente: dict | None = None


class EpilogoIn(BaseModel):
    perfil: Perfil
    identidad: Identidad = Identidad()
    camino: str = Field(max_length=120)
    mundo: str = ""
    historia: list[str] = Field(max_length=14)
    resumen: dict
    anio_final: int


# ---------------------------------------------------------------- lo que devuelve Claude
class PerfilLeido(BaseModel):
    """Campos del perfil que Claude pudo sacar del CV o del texto. Lo que no esté queda en null."""

    edad: int | None = Field(None, description="Edad actual si se puede inferir (por ejemplo del año de egreso); si no, null.")
    sexo: Literal["h", "m"] | None = Field(None, description="Solo si la persona lo declara de forma explícita.")
    edu: Edu | None = Field(None, description="Nivel más alto terminado: media, tecnica (CFT o IP), universitaria o postgrado.")
    area: str | None = Field(None, description="Área de la carrera, una de la lista entregada.")
    estado: Literal["empleado", "buscando"] | None = None
    tipo_empleador: TipoEmpleador | None = Field(None, description="grande (200 o más personas), pyme, startup, publico o extranjero (empleador de otro país, trabajando desde Chile).")
    rubro: str | None = Field(None, description="Rubro del empleador actual o del último, uno de la lista entregada.")
    nivel: int | None = Field(None, description="0 junior, 1 semi senior, 2 senior, 3 jefatura, 4 gerencia.")
    antiguedad: int | None = Field(None, description="Años completos en el empleador actual.")
    ingles: bool | None = Field(None, description="true si trabaja o puede trabajar en inglés.")
    usa_ia: bool | None = Field(None, description="true si usa herramientas de IA en su trabajo.")
    pareja: Literal["no", "pololeo", "convive", "casado"] | None = None
    hijos: int | None = None


class PrioridadesLeidas(BaseModel):
    dinero: int
    carrera: int
    bienestar: int
    vida_personal: int


class GemeloLeido(BaseModel):
    perfil: PerfilLeido
    empresa: str | None = Field(None, description="Nombre del empleador actual o del último, si aparece.")
    cargo: str | None = Field(None, description="Cargo actual o último.")
    gemelo_md: str = Field(description="El gemelo en prosa, en segunda persona y en español de Chile: quién eres, qué te mueve, qué te cuesta y cómo tomas decisiones laborales. Entre 500 y 900 caracteres. Solo afirma lo que el material respalda.")
    rasgos: list[str] = Field(description="De 3 a 5 rasgos cortos que resumen cómo decide esta persona, cada uno de 2 a 5 palabras.")
    prioridades: PrioridadesLeidas = Field(description="Reparto de 100 puntos entre lo que le importa. Si el material no dice nada sobre esto, 25 a cada una.")
    riesgo: int = Field(description="Tolerancia al riesgo de 1 (muy baja) a 5 (muy alta). 3 si no hay señales.")
    politica: list[Propension] = Field(description="Cómo decidiría esta persona: una fila por cada opción de cada decisión del catálogo.")


class OpcionNarrada(BaseModel):
    id: str = Field(description="Id de la opción, sin cambios.")
    titulo: str = Field(description="La opción como acción concreta para esta persona, máximo 48 caracteres. Ej.: «Irte a Fintoc con acciones».")
    texto: str = Field(description="Qué significa en su vida, una frase de máximo 80 caracteres.")


class CasoNarrado(BaseModel):
    titulo: str = Field(description="La situación del año en una o dos frases cortas que terminan en pregunta, máximo 95 caracteres. Ej.: «Llevas dos años sin aumento. ¿Lo pides?»")
    opciones: list[OpcionNarrada]


class Mensaje(BaseModel):
    de: str = Field(description="Quién escribe: Mamá, Papá, tu pareja, Los cabros, una amiga. Nunca un nombre propio de persona.")
    mensaje: str = Field(description="El mensaje, como se escribe por chat en Chile, máximo 60 caracteres.")
    hora: str = Field(description="Hora en formato 24 h, por ejemplo 22:30.")


class AnioNarrado(BaseModel):
    titulo: str = Field(description="Título del año, de 2 a 5 palabras y con punto final. Ej.: «Las noches largas.»")
    relato: str = Field(description="Lo que pasó, en una o dos frases. Máximo 200 caracteres.")
    perdido: list[str] = Field(default_factory=list, description="Solo si `te_perdiste` viene en los datos: 1 o 2 cosas concretas que te perdiste, máximo 55 caracteres cada una. Si no, lista vacía.")
    mensajes: list[Mensaje] = Field(default_factory=list, description="Solo si `tono` es noche: 2 o 3 mensajes de tu gente que no alcanzaste a contestar. Si no, lista vacía.")
    momento: list[str] = Field(default_factory=list, description="Solo si viene `momento`: tres frases cortas que cuentan ese golpe de a poco; la tercera es la que pega. Máximo 80 caracteres cada una. Si no, lista vacía.")


class HistoriaOut(BaseModel):
    anio: AnioNarrado | None = Field(None, description="El año que cerró. null si no se entregó `anio`.")
    caso: CasoNarrado | None = Field(None, description="La decisión que viene. null si no se entregó `pendiente`.")


class CaminosIn(BaseModel):
    perfil: Perfil
    prioridades: Prioridades = Prioridades()
    identidad: Identidad = Identidad()
    semilla: int = Field(ge=0, le=2**31)


class CaminoNarrado(BaseModel):
    id: str = Field(description="Id del camino, sin cambios.")
    titulo: str = Field(description="El camino como acción concreta para esta persona, máximo 48 caracteres.")
    texto: str = Field(description="Qué significa en su vida, una frase de máximo 80 caracteres.")


class CaminosOut(BaseModel):
    titulo: str = Field(description="Dónde está hoy la persona en una frase corta y la pregunta «¿Y ahora?». Máximo 80 caracteres. Ej.: «Dos años en la pyme y ganas de más. ¿Y ahora?»")
    elegidos: list[CaminoNarrado] = Field(description="Los 4 caminos que más le hacen sentido a esta persona, del más al menos relevante.")


class EpilogoOut(BaseModel):
    titulo: str = Field(description="Título de esta vida, máximo 50 caracteres, con punto final.")
    historia: str = Field(description="La década contada de corrido, en segunda persona, en 2 párrafos cortos separados por una línea en blanco. Máximo 600 caracteres.")
    cv: list[str] = Field(description="Entre 4 y 6 líneas del currículum al terminar la década, del más reciente al más antiguo, cada una con año y máximo 70 caracteres.")
    lo_que_te_llevas: str = Field(description="Una frase sobre lo que esta vida muestra de la decisión inicial, sin dar consejos. Máximo 160 caracteres.")
