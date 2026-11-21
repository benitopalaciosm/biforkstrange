"""Del perfil que llena la persona (9 campos) al estado completo del gemelo.

El paquete describe a una persona con 90 variables. La persona declara 9; el
resto parte de los valores por defecto de `estado.json` o de los de este archivo,
que son supuestos del equipo y están marcados como tales.
"""

from dataclasses import asdict, dataclass

from app.sim.motor.paquete import Paquete

NIVELES = ("Junior", "Semi senior", "Senior", "Jefatura", "Gerencia")
EDAD_TITULO = {"media": 18, "tecnica": 21, "universitaria": 24, "postgrado": 26}  # supuesto
OCUPACION_POR_EDU = {"media": 5, "tecnica": 3, "universitaria": 2, "postgrado": 2}  # supuesto
RUBROS_DESTINO = "Comercio"


@dataclass(frozen=True)
class Perfil:
    edad: int = 30
    sexo: str = "m"                       # h | m
    edu: str = "universitaria"            # media | tecnica | universitaria | postgrado
    carrera_id: int = -1                  # fila de mifuturo_carreras; -1 sin carrera
    rubro: str = "Servicios profesionales"
    tipo_empleador: str = "pyme"          # grande | pyme | startup | publico | extranjero
    nivel: int = 1                        # 0 junior ... 4 gerencia
    sueldo: float = 1_400_000             # líquido mensual
    riesgo: int = 5                       # tolerancia al riesgo, 0 a 10
    # Opcionales: si no vienen, se suponen
    estado: str = "empleado"
    ocupacion: int | None = None
    antiguedad: int = 2
    region: str = "rm"
    ahorro: float | None = None

    @classmethod
    def a_los_18(cls, sexo: str = "m", riesgo: int = 5) -> "Perfil":
        """Alguien que sale del colegio: punto de partida de la cohorte de validación."""
        return cls(edad=18, sexo=sexo, edu="media", rubro="", tipo_empleador="", nivel=0, sueldo=0,
                   riesgo=riesgo, estado="estudiando", antiguedad=0)


def _literal(inicio: str):
    """Valor inicial de estado.json cuando es un literal ('0', '44', "''", 'chile')."""
    if inicio == "''":
        return ""
    try:
        return int(inicio)
    except ValueError:
        try:
            return float(inicio)
        except ValueError:
            return inicio if inicio in ("chile", "bien") else None


def estado_inicial(perfil: Perfil, pq: Paquete) -> dict:
    p = asdict(perfil)
    e: dict = {}
    for nombre, v in pq.variables.items():
        if v["inicio"] == "deriva" or v["tipo"] == "eleccion":
            continue
        valor = _literal(str(v["inicio"]))
        if valor is not None:
            e[nombre] = valor
    trabaja = perfil.estado in ("empleado", "independiente", "fundador")
    e.update(
        edad=perfil.edad, sexo=perfil.sexo, edu=perfil.edu, estado=perfil.estado,
        carrera_id=perfil.carrera_id, rubro=perfil.rubro if trabaja else "",
        tipo_empleador=perfil.tipo_empleador if perfil.estado == "empleado" else "",
        nivel=perfil.nivel, sueldo=float(perfil.sueldo) if trabaja else 0.0,
        sueldo_ref=float(perfil.sueldo), antiguedad=perfil.antiguedad if trabaja else 0,
        region=perfil.region, riesgo=perfil.riesgo * 10,
        primer_empleo=1 if perfil.estado in ("estudiando", "buscando") and perfil.sueldo == 0 else 0,
        anos_titulado=max(0, min(40, perfil.edad - EDAD_TITULO[perfil.edu])),
        ocupacion=perfil.ocupacion if perfil.ocupacion is not None
        else (1 if perfil.nivel >= 3 else OCUPACION_POR_EDU[perfil.edu]),
        # supuestos neutros: las fórmulas del paquete están centradas en estos valores
        red=30, skill=50, ambicion=50,
        pareja="no", hijos=0, edad_hijo_menor=-1, ingles=0, isapre=0, propietario=0,
        madre_edad=perfil.edad + round(pq.k("EDAD_MADRE")),
        padre_edad=perfil.edad + round(pq.k("EDAD_MADRE")) + 2,
        area="", tipo_institucion="", semestres_restantes=0,
        # variables que elige el jugador dentro de una opción
        rubro_destino=perfil.rubro or RUBROS_DESTINO, region_destino="Valparaíso",
        ocupacion_destino=2, quien_enferma="madre",
    )
    if perfil.carrera_id >= 0:
        e["area"] = pq.tabla("mifuturo_carreras", "area", "carrera_id", perfil.carrera_id)
        e["tipo_institucion"] = pq.tabla("mifuturo_carreras", "tipo_institucion", "carrera_id", perfil.carrera_id)
    d = pq.derivar(e)
    tramo = "p80+" if d["percentil"] >= 80 else "p50-79" if d["percentil"] >= 50 else "p0-49"
    e["tasa_ahorro"] = pq.k("TASA_AHORRO", tramo)
    e["gasto_mensual"] = pq.tabla("epf_quintiles", "gasto_hogar", "quintil", d["quintil"])
    e["ahorro"] = float(perfil.ahorro) if perfil.ahorro is not None else 2.0 * e["sueldo"]  # supuesto: dos sueldos
    faltan = [n for n, v in pq.variables.items() if v["inicio"] != "deriva" and n not in e]
    if faltan:
        raise ValueError(f"variables sin valor inicial: {faltan}")
    return e
