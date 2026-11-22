"""Gente como tú, de verdad: lo que dicen las encuestas de chilenos con tu edad, tus estudios y tu rubro.

No simula nada. Cada dato es una celda de una tabla del paquete (ESI, EPS), con su fuente y
cuánta gente hay detrás, para ponerla al lado del número que dieron tus gemelos.
"""

from app.sim.motor.paquete import paquete

MIN_N = 60  # una celda de la ESI con menos observaciones no se muestra: se sube a un grupo más grande

_EDU_ESI = {"media": "media_o_menos", "tecnica": "tecnica", "universitaria": "universitaria", "postgrado": "postgrado"}
_EDU_TEXTO = {
    "media": "con educación media", "tecnica": "con estudios técnicos",
    "universitaria": "con estudios universitarios", "postgrado": "con postgrado",
}
_SEXO = {"h": ("hombre", "hombres"), "m": ("mujer", "mujeres")}


def _banda_esi(edad: int) -> str:
    """Las bandas de la ESI: 18-24 y de a cinco años hasta 50-54."""
    if edad < 25:
        return "18-24"
    inicio = min(50, 25 + 5 * ((edad - 25) // 5))
    return f"{inicio}-{inicio + 4}"


def _banda_eps(edad: int) -> str:
    return "18-29" if edad < 30 else "30-44" if edad < 45 else "45-59"


def _anios(banda: str) -> str:
    a, b = banda.split("-")
    return f"de {a} a {b} años"


def _plata(n: float) -> str:
    """$1.100.000: redondeado a $10.000, como el resto del juego."""
    return "$" + f"{round(n, -4):,.0f}".replace(",", ".")


def _fuente(fuente_id: str) -> dict:
    f = paquete().fuentes.get(fuente_id, {})
    return {"fuente": f.get("cita", fuente_id), "fuente_url": f.get("url") or None}


def _num(v) -> float | None:
    try:
        return float(v) if v not in ("", None) else None
    except (TypeError, ValueError):
        return None


def sueldo(edad: int, sexo: str, edu: str, rubro: str = "") -> dict | None:
    """El sueldo líquido mediano de quienes se parecen a ti (ESI 2025).

    Primero tu rubro y tu edad; si esa celda es chica, tu sexo, edad y estudios; si también, sin el sexo.
    """
    pq = paquete()
    banda = _banda_esi(edad)
    for f in pq.filas("esi_ingreso_rubro_edad"):
        if rubro and f["rubro"] == rubro and f["banda_edad"] == banda and int(f["n"]) >= MIN_N and _num(f["p50"]):
            p50 = _num(f["p50"])
            quienes = f"los chilenos {_anios(banda)} que trabajan en {rubro}"
            return _dato_sueldo(p50, quienes, int(f["n"]), "esi_ingreso_rubro_edad")
    # de lo más parecido a lo más amplio: tu sexo y edad, solo tu edad, y por último todas las edades (18-54)
    grupos = [*([(*_SEXO[sexo], banda)] if sexo in _SEXO else []), ("todos", "chilenos", banda), ("todos", "chilenos", "18-54")]
    filas = pq.filas("esi_ingreso_sexo_edad_edu")
    for s, plural, b in grupos:
        for f in filas:
            if (f["sexo"] == s and f["banda_edad"] == b and f["educacion"] == _EDU_ESI.get(edu)
                    and int(f["n"]) >= MIN_N and _num(f["p50"])):
                quienes = f"los {plural} {_anios(b)} {_EDU_TEXTO[edu]}"
                return _dato_sueldo(_num(f["p50"]), quienes, int(f["n"]), "esi_ingreso_sexo_edad_edu")
    return None


def _dato_sueldo(p50: float, quienes: str, n: int, tabla: str) -> dict:
    return {
        "clave": "sueldo", "titulo": "Lo que ganan",
        "frase": f"La mitad de {quienes} gana menos de {_plata(p50)} líquidos al mes.",
        "cifra": round(p50), "unidad": "pesos al mes", "n": n, "tabla": tabla, **_fuente("ine_esi_2025"),
    }


def cambio_de_pega(edad: int) -> dict | None:
    """De cada 100 personas con trabajo de tu edad, cuántas se cambian directo a otro empleador en un año (EPS)."""
    banda = _banda_eps(edad)
    for f in paquete().filas("eps_terminos_empleo"):
        if f["periodo"] == "2016_2024" and f["banda"] == banda:
            cambio = round(float(f["cambio_empleador_directo"]) * 100)
            a_cesantia = round(float(f["pasa_a_cesantia"]) * 100)
            return {
                "clave": "cambio_de_pega", "titulo": "Cuánto se cambian de pega",
                "frase": (f"De cada 100 chilenos {_anios(banda)} con trabajo, {cambio} se cambian directo a otro "
                          f"empleador en un año y {a_cesantia} pasan a la cesantía."),
                "cifra": cambio, "unidad": "de cada 100, en un año", "n": int(f["personas"]),
                "tabla": "eps_terminos_empleo", **_fuente("eps_2024"),
            }
    return None


def cesantia(edad: int) -> dict | None:
    """Cuánto dura una cesantía para alguien de tu edad: la mediana y cuántos siguen buscando al año (EPS)."""
    banda = _banda_eps(edad)
    for f in paquete().filas("eps_cesantia_duracion"):
        if f["banda"] == banda:
            meses = round(float(f["mediana_meses"]))
            al_anio = round(float(f["sigue_12m"]) * 100)
            return {
                "clave": "cesantia", "titulo": "Si te quedas sin pega",
                "frase": (f"Cuando un chileno {_anios(banda)} queda cesante, la mitad vuelve a trabajar antes de "
                          f"{meses} meses; {al_anio} de cada 100 siguen buscando al año."),
                "cifra": meses, "unidad": "meses (mediana)", "n": int(f["episodios"]),
                "tabla": "eps_cesantia_duracion", **_fuente("eps_2024"),
            }
    return None


def datos(edad: int, sexo: str, edu: str, rubro: str = "", estado: str = "empleado") -> list[dict]:
    """Hasta 3 datos reales de gente como tú, cada uno con su fuente. Quien busca pega ve primero la cesantía."""
    lista = [sueldo(edad, sexo, edu, rubro), cambio_de_pega(edad), cesantia(edad)]
    if estado == "buscando":
        lista = [lista[2], lista[0], lista[1]]
    return [d for d in lista if d][:3]
