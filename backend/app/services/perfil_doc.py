"""Tu perfil armado por tu propio Claude.

El flujo:
1. La app te da un prompt (`prompt()`).
2. Lo pegas en tu Claude (claude.ai, la app o Claude Code). Tu Claude ya te conoce por sus memorias
   y conversaciones, así que arma tu documento sin que tengas que escribirlo; si le falta algo, te pregunta.
3. Pegas o subes ese documento en la app, que lo lee sin llamar a ningún modelo (`leer_documento()`).

El documento trae un bloque con formato fijo (```gemelo-laboral ... ```) para que leerlo sea exacto,
y una sección "Cómo lo deduje" para que la persona sepa qué revisar.
"""

import re
import unicodedata
from functools import lru_cache

from app.sim.motor.motor import DECISIONES_PERSONALES
from app.sim.motor.paquete import Paquete, paquete
from app.sim.motor.perfil import NIVELES

BLOQUE = "gemelo-laboral"
_RE_BLOQUE = re.compile(r"```\s*" + BLOQUE + r"\s*\n(.*?)```", re.S | re.I)
_RE_DEDUJE = re.compile(r"^#+\s*c[oó]mo lo deduje\s*$(.*?)(?=^#+\s|\Z)", re.S | re.I | re.M)
_VACIO = {"", "?", "-", "no se", "no sé", "desconocido", "sin dato", "null", "ninguno", "ninguna"}

ESTUDIOS = {"media": "media", "tecnica": "tecnica", "técnica": "tecnica", "universitaria": "universitaria",
            "postgrado": "postgrado", "posgrado": "postgrado", "magister": "postgrado", "magíster": "postgrado",
            "doctorado": "postgrado"}
TIPOS = {"grande": "grande", "pyme": "pyme", "startup": "startup", "publico": "publico", "público": "publico",
         "estado": "publico", "extranjero": "extranjero", "afuera": "extranjero"}
SEXOS = {"h": "h", "hombre": "h", "m": "m", "mujer": "m"}
REGIONES = {"rm": "rm", "metropolitana": "rm", "santiago": "rm", "otra": "otra", "region": "otra", "regiones": "otra"}


def _normal(texto: str) -> str:
    sin = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9 ]+", " ", sin.lower()).strip()


def _dudas_laborales(pq: Paquete) -> list[dict]:
    return [d for id_, d in pq.decisiones.items()
            if d["aparicion"]["tipo"] == "carta" and id_ not in DECISIONES_PERSONALES]


@lru_cache(maxsize=1)
def prompt(pq: Paquete | None = None) -> str:
    """El prompt que la persona le pega a su Claude."""
    pq = pq or paquete()
    rubros = [r for r in pq.variables["rubro"]["dominio"] if r]
    ocupaciones = sorted({(int(f["origen"]), f["origen_nombre"]) for f in pq.filas("jobhop_transiciones")})
    dudas = _dudas_laborales(pq)
    lineas = [
        "Voy a usar Gemelo Laboral, un simulador que muestra cómo les va en 10 años a 100 \"gemelos\" míos "
        "(misma persona, otra suerte) según las decisiones de carrera que tome en Chile. Necesito que armes "
        "mi perfil con lo que sabes de mí por nuestras conversaciones y tus memorias.",
        "",
        "Cómo hacerlo:",
        "1. Usa solo lo que sabes de mí o lo que yo te diga. No inventes: un dato inventado se verá como mío.",
        "2. Si no sabes algo importante (sobre todo mi sueldo, mi tolerancia al riesgo o la duda que tengo), "
        "pregúntamelo antes de escribir el documento: en un solo mensaje, con preguntas cortas. Si no te "
        "respondo, deja ese campo en ?.",
        "3. Después escribe el documento con este formato exacto (el bloque y los nombres de los campos "
        "tal cual, porque la app los lee sin interpretar):",
        "",
        "```" + BLOQUE,
        "edad: <años>",
        "sexo: <h o m>",
        "estudios: <media, tecnica, universitaria o postgrado: el nivel más alto TERMINADO>",
        "carrera: <nombre de mi título de pregrado o técnico, o ? si no tengo>",
        "institucion: <U, IP o CFT: dónde estudié esa carrera>",
        "rubro: <uno de la lista de rubros, copiado exacto: el rubro de mi EMPLEADOR, no de mi oficio>",
        "tipo_empresa: <grande, pyme, startup, publico o extranjero>",
        "cargo: <número de la lista de cargos>",
        "sueldo_liquido: <pesos líquidos al mes, solo números>",
        "riesgo: <de 0 a 10, cuánto riesgo estoy dispuesto a tomar en mi carrera>",
        "ocupacion: <número de la lista de tipos de trabajo: lo que HAGO>",
        "antiguedad: <años completos en mi empleador actual>",
        "region: <rm si trabajo en la Región Metropolitana, otra si no>",
        "ingles: <si, si trabajo o podría trabajar en inglés (intermedio o más); no, si no>",
        "experiencia: <años de experiencia laboral desde mi primer trabajo formal>",
        "empleadores: <cuántos empleadores distintos he tenido, contando el actual>",
        "empresa: <el nombre de mi empleador actual>",
        "duda: <el código de la duda que más me da vueltas hoy, de la lista de dudas>",
        "```",
        "",
        "## Cómo lo deduje",
        "- <una línea por cada campo que no te dije literalmente: de dónde lo sacaste>",
        "",
        "Reglas de los campos:",
        "- Todo describe mi situación de HOY: el trabajo que tengo ahora, no los anteriores.",
        "- tipo_empresa: grande = privada de 200 personas o más; pyme = privada más chica; startup = empresa "
        "joven de base tecnológica que busca crecer rápido; publico = el Estado; extranjero = trabajo desde "
        "Chile para una empresa de afuera.",
        "- sueldo_liquido: si solo sabes el bruto, el líquido es cerca de 82% del bruto; dilo en \"Cómo lo deduje\".",
        "- Si un campo no se puede saber, escribe ? en vez de adivinar.",
        "",
        "Rubros:", *[f"- {r}" for r in rubros],
        "",
        "Cargos:", *[f"- {i}: {n}" for i, n in enumerate(NIVELES)],
        "  (3 = tener personas a cargo; 4 = dirigir un área o la empresa)",
        "",
        "Tipos de trabajo (ocupacion):", *[f"- {g}: {n}" for g, n in ocupaciones],
        "",
        "Dudas (código: pregunta):", *[f"- {d['id']}: {d['pregunta']}" for d in dudas],
        "",
        "Responde solo con el documento (o con tus preguntas, si te falta algo).",
    ]
    return "\n".join(lineas)


def _campos(bloque: str) -> dict[str, str]:
    salida = {}
    for linea in bloque.splitlines():
        linea = linea.split("#", 1)[0].strip()
        if ":" not in linea:
            continue
        clave, valor = (x.strip() for x in linea.split(":", 1))
        valor = valor.strip("<>\"' ")
        if _normal(valor) not in _VACIO:
            salida[_normal(clave).replace(" ", "_")] = valor
    return salida


def _entero(valor: str) -> int | None:
    numeros = re.sub(r"[^\d]", "", valor.split(",")[0])
    return int(numeros) if numeros else None


def _carrera(nombre: str, institucion: str | None, pq: Paquete) -> tuple[int | None, str | None]:
    """Busca el título en el catálogo de mifuturo. Devuelve (carrera_id, nota)."""
    buscado = _normal(nombre)
    filas = pq.filas("mifuturo_carreras")
    if institucion:
        mismas = [f for f in filas if f["tipo_institucion"].upper() == institucion.upper()]
        filas = mismas or filas
    exactas = [f for f in filas if _normal(f["carrera"]) == buscado]
    if exactas:
        return int(exactas[0]["carrera_id"]), None
    palabras = set(buscado.split()) - {"de", "en", "y", "la", "el"}
    mejor, puntaje = None, 0.0
    for f in filas:
        otras = set(_normal(f["carrera"]).split()) - {"de", "en", "y", "la", "el"}
        if not palabras or not otras:
            continue
        p = len(palabras & otras) / len(palabras | otras)
        if p > puntaje:
            mejor, puntaje = f, p
    if mejor and puntaje >= 0.5:
        return int(mejor["carrera_id"]), f"carrera: «{nombre}» se tomó como «{mejor['carrera']}» ({mejor['tipo_institucion']})."
    return None, f"carrera: «{nombre}» no está en el catálogo de carreras; se simula sin carrera."


def leer_documento(texto: str, pq: Paquete | None = None) -> dict | None:
    """Lee el documento que armó el Claude de la persona. None si el texto no trae el bloque.

    Devuelve lo mismo que `perfil_ia.completar` más `duda` (la duda inicial, si es válida) y `avisos`
    (valores del documento que no se pudieron usar).
    """
    from app.services.perfil_ia import PerfilLeido, completar

    pq = pq or paquete()
    encontrado = _RE_BLOQUE.search(texto)
    if not encontrado:
        return None
    c = _campos(encontrado.group(1))
    avisos: list[str] = []
    leido: dict = {}

    def opcion(campo: str, destino: str, tabla: dict[str, str], nombre: str) -> None:
        if campo in c:
            valor = tabla.get(_normal(c[campo]))
            if valor is None:
                avisos.append(f"{nombre}: «{c[campo]}» no es una opción válida.")
            leido[destino] = valor

    def numero(campo: str, destino: str, nombre: str) -> None:
        if campo in c:
            valor = _entero(c[campo])
            if valor is None:
                avisos.append(f"{nombre}: «{c[campo]}» no es un número.")
            leido[destino] = valor

    numero("edad", "edad", "edad")
    opcion("sexo", "sexo", SEXOS, "sexo")
    opcion("estudios", "edu", ESTUDIOS, "estudios")
    opcion("tipo_empresa", "tipo_empleador", TIPOS, "tipo de empresa")
    opcion("region", "region", REGIONES, "región")
    opcion("ingles", "ingles", {"si": True, "no": False}, "inglés")
    numero("experiencia", "anios_experiencia", "experiencia")
    numero("empleadores", "empleadores", "empleadores")
    if c.get("empresa") and _normal(c["empresa"]) not in _VACIO:
        leido["empresa_actual"] = c["empresa"]
    for campo, destino, nombre in (("cargo", "nivel", "cargo"), ("sueldo_liquido", "sueldo", "sueldo"),
                                   ("riesgo", "riesgo", "riesgo"), ("ocupacion", "ocupacion", "tipo de trabajo"),
                                   ("antiguedad", "antiguedad", "antigüedad")):
        numero(campo, destino, nombre)
    if "cargo" in c and leido.get("nivel") is None:  # también acepta el nombre del cargo
        por_nombre = {_normal(n): i for i, n in enumerate(NIVELES)}
        leido["nivel"] = por_nombre.get(_normal(c["cargo"]))
        if leido["nivel"] is not None:  # el aviso de "no es un número" ya no aplica
            avisos[:] = [a for a in avisos if not a.startswith("cargo:")]
    if "rubro" in c:
        rubros = {_normal(r): r for r in pq.variables["rubro"]["dominio"] if r}
        leido["rubro"] = rubros.get(_normal(c["rubro"])) or next(
            (r for n, r in rubros.items() if _normal(c["rubro"]) in n), None)
        if leido["rubro"] is None:
            avisos.append(f"rubro: «{c['rubro']}» no está en la lista de rubros.")
    notas = [linea.strip()[1:].strip() for linea in
             (_RE_DEDUJE.search(texto).group(1).splitlines() if _RE_DEDUJE.search(texto) else [])
             if linea.strip().startswith(("-", "*"))]
    if "carrera" in c:
        leido["carrera_id"], nota = _carrera(c["carrera"], c.get("institucion"), pq)
        if nota:
            notas.append(nota)

    resultado = completar(PerfilLeido(**leido, inferido=notas), pq)
    # completar descarta en silencio lo que está fuera de rango: se avisa
    for campo in ("edad", "nivel", "riesgo", "ocupacion", "antiguedad", "sueldo"):
        if leido.get(campo) is not None and resultado["perfil"].get(campo) != leido[campo]:
            avisos.append(f"{campo}: {leido[campo]} está fuera de rango; se usó un valor por defecto.")

    duda = None
    if "duda" in c:
        from app.sim.motor.partida import dudas_posibles
        from app.sim.motor.perfil import Perfil

        codigo = _normal(c["duda"]).replace(" ", "_")
        posibles = {d["decision"] for d in dudas_posibles(Perfil(**resultado["perfil"]), pq)}
        if codigo in posibles:
            duda = codigo
        else:
            avisos.append(f"duda: «{c['duda']}» no es una duda posible para este perfil; elígela en la lista.")
    return {**resultado, "duda": duda, "avisos": avisos}
