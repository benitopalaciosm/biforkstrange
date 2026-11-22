"""El juego hecho a tu medida: tu relato libre y los rasgos afinados de tu gemelo.

Cada fuente tiene un solo efecto; ninguna toca las reglas, los resultados ni los mundos de comparación:
1. Tu gemelo decide QUÉ cartas te salen: cada carta pesa más o menos según tus rasgos medidos
   (afinidad). Solo en tu partida; la población calibrada y los mundos de comparación no cambian.
2. Tu relato decide CÓMO se cuentan: Claude reescribe la situación de la carta y el detalle de
   cada opción con lo que contaste y lo que ya viviste. Se guarda en memoria para que la misma carta
   no cambie de texto cada vez que la partida se vuelve a jugar.
"""

import hashlib
import logging
import math
from dataclasses import dataclass, field

from pydantic import BaseModel

from app.core.config import get_settings
from app.twin.profile import TwinProfile

log = logging.getLogger(__name__)

PERFIL_CHARS = 6000
FUERZA = 1.2  # supuesto: un rasgo en el extremo, medido con certeza, multiplica el peso por ~e^1.2 ≈ 3,3
SD_SIN_DATO = 25  # sobre esta duda el rasgo no se usa

# Qué rasgos del gemelo hacen más probable cada carta. Un "-" invierte el rasgo.
AFINIDAD: dict[str, list[str]] = {
    "emprender": ["rcar", "rfin", "E", "vind", "pro"],
    "unirse_a_startup": ["rcar", "rfin", "ope", "pro"],
    "independizarse": ["vind", "rcar", "E"],
    "oferta_externa": ["rcar", "pro", "ent"],
    "buscar_estando_empleado": ["rcar", "pro", "-vcon"],
    "renunciar": ["rcar", "-est", "-vcon"],
    "cambiar_de_rubro": ["rcar", "ope", "int"],
    "cambiar_de_ocupacion": ["rcar", "ope", "int"],
    "magister": ["int", "I", "vlog", "vrec"],
    "doctorado": ["int", "I", "-vcon"],
    "bootcamp": ["int", "pro", "I"],
    "volver_a_estudiar": ["int", "I"],
    "aprender_ia": ["int", "I", "pro"],
    "pedir_aumento": ["ase", "vrec", "vcon"],
    "jefatura": ["ase", "vrec", "E", "ent"],
    "trabajar_mas_horas": ["ind", "vlog", "vrec"],
    "media_jornada": ["vind", "-ind", "vrel"],
    "pedir_hibrido": ["vind", "-ent"],
    "remoto_para_afuera": ["vind", "rcar", "int"],
    "sabatico": ["ope", "-vcon", "-ind"],
    "invertir_en_red": ["ent", "E", "vrel"],
    "emigrar": ["ope", "rcar", "-vrel"],
    "mudarse_de_region": ["ope", "rcar"],
    "intercambio": ["ope", "int"],
    "ahorro": ["ord", "vcon", "-rfin"],
    "comprar_vivienda": ["vcon", "ord", "-rfin"],
}


@dataclass
class Personal:
    texto: str  # lo que el narrador sabe de la persona: solo su relato ("" si no escribió nada)
    afinidad: dict[str, float] = field(default_factory=dict)  # del gemelo: solo qué cartas te salen

    @property
    def clave(self) -> str:
        return hashlib.sha1(self.texto.encode()).hexdigest()[:16]


def _valor(p: TwinProfile, k: str) -> float | None:
    """Rasgo centrado en 0 (−1 a 1), atenuado por la duda; None si el gemelo no sabe."""
    inv = k.startswith("-")
    d = p.dims.get(k.lstrip("-"))
    if d is None or d.sd > SD_SIN_DATO:
        return None
    confianza = 1 - (d.sd - 6) / (SD_SIN_DATO - 6)  # 1 con certeza, 0 en el umbral
    x = (d.m - 50) / 50 * max(0.0, min(1.0, confianza))
    return -x if inv else x


def afinidad(p: TwinProfile) -> dict[str, float]:
    out = {}
    for carta, rasgos in AFINIDAD.items():
        vals = [v for v in (_valor(p, k) for k in rasgos) if v is not None]
        if vals:
            out[carta] = round(math.exp(FUERZA * sum(vals) / len(vals)), 3)
    return out


def desde(relato: str, gemelo: TwinProfile | None) -> Personal | None:
    relato = relato.strip()
    if not relato and gemelo is None:
        return None
    return Personal(
        texto=f"CÓMO SE DESCRIBE, EN SUS PALABRAS:\n{relato[:PERFIL_CHARS]}" if relato else "",
        afinidad=afinidad(gemelo) if gemelo else {},
    )


# ---------------------------------------------------------------- narración con Claude

class _OpcionOut(BaseModel):
    opcion: str
    detalle: str


class _CartaOut(BaseModel):
    situacion: str
    opciones: list[_OpcionOut]


_cache: dict[tuple, dict] = {}


def _prompt(personal: Personal, carta: dict, contexto: dict, plantilla: str, vivido: str) -> str:
    ops = "\n".join(f'- "{o["opcion"]}": {o["nombre"]}. {o.get("detalle", "")}' for o in carta["opciones"])
    ctx = ", ".join(f"{k} {v}" for k, v in contexto.items() if v not in ("", None))
    return f"""Eres el narrador de un juego sobre decisiones de trabajo. Cada año a la persona le llega una carta: una situación y opciones. El motor del juego ya decidió QUÉ carta es y QUÉ hace cada opción; tú solo la cuentas a la medida de esta persona.

QUIÉN ES
{personal.texto}

DÓNDE ESTÁ HOY (estado del juego): {ctx}

LO QUE YA VIVIÓ EN ESTA PARTIDA
{vivido or "(es su primer año)"}

LA CARTA: {carta["nombre"]} — {carta["pregunta"]}
Versión genérica de la situación: {plantilla or "(no hay)"}
Opciones (no cambies qué significa cada una):
{ops}

Escribe:
- "situacion": 2–3 frases (máximo 55 palabras), segunda persona, español de Chile. Que nazca de su vida: su pega, lo que le importa, lo que contó y lo que ya vivió en la partida. Concreta (un lugar, una persona, un momento).
- "opciones": para CADA opción, con su mismo id en "opcion", un "detalle" de máximo 14 palabras que diga qué significaría para ESTA persona.

Reglas: no inventes cifras (montos, porcentajes), ni datos de salud o de terceros. Respeta el estado del juego aunque choque con lo que contó (el juego manda). Género: el que use al hablar de sí; si no está claro, neutro."""


def _vivido(salida: dict) -> str:
    lineas = []
    for a in salida.get("historia", [])[-6:]:
        hechos = [f'{d["nombre"]}: {d.get("opcion_nombre", "")}' for d in a.get("decisiones", [])]
        malos = [e["nombre"] for e in a.get("eventos", []) if e.get("tono") in ("malo", "bueno") and not e.get("rutina")]
        lineas.append(f'- {a.get("edad")} años: ' + "; ".join(hechos + malos))
    return "\n".join(lineas)


def _llm():
    from app.core.llm import get_claude

    return get_claude(get_settings().anthropic_model)


def narrar_pendiente(salida: dict, personal: Personal, semilla: int) -> None:
    """Reescribe la carta pendiente a tu medida (en el lugar). Sin API key o si Claude falla, queda la plantilla."""
    pend = salida.get("pendiente")
    if not pend or not get_settings().llm_enabled:
        return
    anio = salida["anio"]
    ocurrencia = sum(1 for d in (salida.get("anio_en_curso") or {}).get("decisiones", []) if d["decision"] == pend["decision"])
    clave = (personal.clave, semilla, anio, pend["decision"], ocurrencia)
    hecho = _cache.get(clave)
    if hecho is None:
        plantilla = (pend.get("narrativa") or {}).get("situacion", "")
        ids = {o["opcion"] for o in pend["opciones"]}

        def check(o: _CartaOut):
            if not o.situacion.strip() or {x.opcion for x in o.opciones} != ids:
                raise ValueError(f"Devuelve una entrada por opción, con estos ids: {sorted(ids)}")

        try:
            out = _llm().ask(_prompt(personal, pend, salida["estado"], plantilla, _vivido(salida)), _CartaOut,
                             check=check, max_tokens=4000, fast=True)
        except Exception as e:  # el juego sigue con la plantilla
            log.warning("No se pudo personalizar la carta %s: %s", pend["decision"], e)
            return
        hecho = {"situacion": out.situacion.strip(), "detalles": {o.opcion: o.detalle.strip() for o in out.opciones}}
        _cache[clave] = hecho
    _aplicar(pend, hecho)
    pend["personalizada"] = True


def _aplicar(d: dict, hecho: dict) -> None:
    d["narrativa"] = {**(d.get("narrativa") or {}), "situacion": hecho["situacion"]}
    for o in d.get("opciones") or []:
        if o["opcion"] in hecho["detalles"]:
            o["detalle"] = hecho["detalles"][o["opcion"]]


def historia_personal(salida: dict, personal: Personal, semilla: int) -> None:
    """Las cartas ya respondidas conservan el texto con que te llegaron."""
    for a in salida.get("historia", []) + ([salida["anio_en_curso"]] if salida.get("anio_en_curso") else []):
        for d in a.get("decisiones", []):
            hecho = _cache.get((personal.clave, semilla, a["anio"] - 1, d["decision"], d.get("ocurrencia", 0)))
            if hecho:
                d["narrativa"] = {**(d.get("narrativa") or {}), "situacion": hecho["situacion"]}
