"""Motor: hace vivir un gemelo año a año aplicando las reglas del paquete.

Un año tiene cuatro pasos:

1. Mundo: se sortea si hay recesión, antes de todo lo demás, para que el resto del año la vea.
2. Decisión del año: la bifurcación (solo el primer año), o una decisión forzada, o una carta
   sorteada por peso. Quien responde es el jugador o la política de los gemelos.
3. Eventos: despido, ascenso, oferta, alza del sueldo, pareja, etc., cada uno con su
   probabilidad anual.
4. Cierre: ahorro, energía, antigüedad, relojes de la startup y vencimiento de efectos.

Es determinista dada `(semilla, indice)`. Cada sorteo usa un flujo propio derivado de
`(semilla, indice, año, clave)`: dos caminos con el mismo índice comparten la suerte del
mundo (misma recesión, mismo dado de despido), así que su diferencia viene de la decisión.

Los efectos de un resultado se calculan sobre el estado previo al resultado y se aplican en
orden. Así `sueldo_ref = sueldo; sueldo = 0; ahorro += sueldo * antigüedad` paga la
indemnización con el sueldo que tenías.

`Vida.correr()` es un generador: entrega una `Pregunta` cada vez que hay que elegir y
recibe el id de la opción.
"""

from __future__ import annotations

import copy
import hashlib
from collections.abc import Callable, Generator
from dataclasses import dataclass
from random import Random

from app.sim.catalogo import Catalogo, Decision, Evento, Opcion, Resultado
from app.sim import mercado
from app.sim.empresas import contexto as contexto_empresa
from app.sim.indicadores import NOMBRES, felicidad, indicadores

_SILENCIOSOS = {"alza_anual", "animo_vuelve"}
_TIROS_PREVIA = 6
# Opciones de no hacer nada: en el mercado no se muestran, porque ya está «Seguir en tu pega».
QUEDARSE = {"quedarse", "no", "esperar", "aguantar", "rechazar", "seguir_igual", "arrendar", "normal", "ignorar", "intentar", "espera"}
_SIN_REPETIR = 2  # una carta no vuelve a salir en los dos años siguientes
# Golpes que oscurecen el año (modo noche). Un aumento negado no alcanza.
_PESADOS = {"separacion_empleo", "startup_cierra", "termina_pareja", "separarse", "seguir_con_tu_empresa", "licencia_salud_mental",
            "jefatura", "emigrar", "bootcamp", "cesantia", "sabatico", "magister"}
_OCUPADO = ("empleado", "fundador", "independiente")
_NULO = Random(0)  # para expresiones que no sortean (cuando, pesos, probabilidades)


@dataclass(slots=True)
class Alternativa:
    """Una opción elegible. `id` puede traer una elección adentro: 'cambiar@Minería'."""

    id: str
    opcion: Opcion
    nombre: str
    eleccion: dict | None = None
    oferta: dict | None = None  # oferta del mercado: empresa, cargo y sueldo (ver mercado.py)
    empleador: dict | None = None  # quién pasa a ser tu empleador si la eliges
    decision: Decision | None = None  # opción de otra decisión ofrecida dentro del mercado


@dataclass(slots=True)
class Pregunta:
    anio: int
    decision: Decision
    alternativas: list[Alternativa]
    origen: str  # mercado | forzada | carta | consecuencia


def _flujo(semilla: int, indice: int, anio: int, clave: str) -> Random:
    h = hashlib.blake2b(f"{semilla}|{indice}|{anio}|{clave}".encode(), digest_size=8).digest()
    return Random(int.from_bytes(h, "big"))


class Vida:
    def __init__(self, cat: Catalogo, estado: dict, prioridades: dict[str, float], semilla: int, indice: int = 0, detalle: bool = False,
                 politica: dict[str, dict[str, float]] | None = None, empleador: dict | None = None,
                 auto: "Callable[[Vida, Pregunta], str] | None" = None, cargo: str = ""):
        self.cat = cat
        self.e = dict(estado)
        self.prioridades = prioridades
        self.semilla = semilla
        self.indice = indice
        self.detalle = detalle
        self.politica = politica  # propensiones propias del gemelo; None = las de juego.json
        self.empleador = empleador  # contexto del empleador actual: solo para la historia
        self.auto = auto  # si viene, el jugador decide una vez al año y esta función responde el resto
        self.cargo = cargo
        self._alts_mercado: list[Alternativa] = []
        self.anios: list[dict] = []
        self.hechos: set[str] = set()  # 'id/resultado' de todo lo que pasó, más marcas del motor
        self._temporales: list[list] = []  # [var, op, valor, previo, años restantes]
        self._bitacora: list[dict] = []
        self._veces: dict[str, int] = {}
        self._preguntadas: set[str] = set()
        self._cartas_vistas: dict[str, int] = {}  # año en que salió cada carta
        self._decidio_jugador = False
        self._empleador_nuevo: dict | None = None
        self._gasto_base = self.e["gasto_mensual"]
        self._edad_hueco = self.e["edad"] if self.e.get("hueco") else None
        self._anos_inactivo = 0
        self._t = 0
        self._recesion = False
        self._sueldo_inicio = self.e["sueldo"]
        self._derivar()
        self._ind_inicio = indicadores(self.cat, self.e)

    # ------------------------------------------------------------------ ciclo
    def correr(self, anios: int) -> Generator[Pregunta, str, None]:
        for t in range(anios):
            self._t = t
            self._bitacora = []
            self._veces = {}
            self._preguntadas = set()
            self._decidio_jugador = False
            self._recesion = False
            self._sueldo_inicio = self.e["sueldo"]
            self._derivar()
            self._ind_inicio = indicadores(self.cat, self.e)
            for ev in self.cat.eventos_mundo:
                yield from self._evento(ev)
            self._recesion = bool(self.e["recesion"])
            if self._recesion and t < 3:
                self.hechos.add("recesion_temprana")
            if self.auto is not None:
                yield from self._temporada()
            else:
                dec, origen = self._decision_del_anio()
                if dec is not None:
                    yield from self._decidir(dec, origen)
            for ev in self.cat.eventos:
                yield from self._evento(ev)
            self._cerrar()

    def _rng(self, clave: str) -> Random:
        n = self._veces.get(clave, 0)
        self._veces[clave] = n + 1
        return _flujo(self.semilla, self.indice, self._t, f"{clave}#{n}" if n else clave)

    def empresa(self, tipo: str, clave: str = "") -> dict | None:
        """Empleador real para ese tipo, fijo dentro del año: la carta y el resultado nombran al mismo."""
        return contexto_empresa(self.cat.paquete, tipo, self.e, _flujo(self.semilla, self.indice, self._t, f"empresa:{tipo}{clave}"))

    # ------------------------------------------------------------------ temporada (partida del jugador)
    def _temporada(self) -> Generator[Pregunta, str, None]:
        """La decisión del año del jugador: ofertas reales, la carta de vida del año y quedarte."""
        e = self.e
        forzada = next((d for d in self.cat.forzadas if self.aplica(d)), None)
        if forzada is not None and forzada.id != "cesantia":
            yield from self._decidir(forzada, "forzada")
            return
        alts = mercado.ofertas(self, self._rng("mercado"))
        if forzada is not None:  # sin pega: las ofertas que llegaron más lo que puedes hacer mientras
            ces = self.cat.decisiones["cesantia"]
            otras = [a for a in self.alternativas(ces) if a.opcion.id != "rapido" or not alts]
            alts += [Alternativa(f"carta:cesantia:{a.id}", a.opcion, a.nombre, a.eleccion, decision=ces) for a in otras]
            pregunta = "Llevas meses buscando. ¿Qué haces?" if alts else ces.pregunta
        else:
            carta, _ = self._decision_del_anio(excluir=mercado.REEMPLAZADAS)
            if carta is not None:
                alts += [Alternativa(f"carta:{carta.id}:{a.id}", a.opcion, a.nombre, a.eleccion, decision=carta)
                         for a in self.alternativas(carta) if a.opcion.id not in QUEDARSE]
            if e["estado"] == "empleado":
                alts.append(mercado.quedarse(self))
            pregunta = "¿Qué haces esta temporada?"
        if not alts:
            return
        self._alts_mercado = alts
        yield from self._decidir(mercado.decision_mercado(pregunta), "mercado")

    def _derivar(self) -> None:
        e = self.e
        self.cat.paquete.derivar(e)
        cuando, prob = self.cat.prob_ascenso
        e["prob_ascenso"] = prob(e, _NULO) if cuando(e, _NULO) else 0

    # ------------------------------------------------------------------ decisiones
    def alternativas(self, dec: Decision) -> list[Alternativa]:
        if dec.id == "mercado":
            return self._alts_mercado
        e = self.e
        out: list[Alternativa] = []
        for o in dec.opciones:
            if o.requisito is not None and not o.requisito(e, _NULO):
                continue
            if dec.id == "cambiar_de_rubro" and o.id == "cambiar":
                for rubro in self._rubros_que_pagan_mas():
                    out.append(Alternativa(f"{o.id}@{rubro}", o, f"Cambiarte a {rubro}", {"rubro_destino": rubro}))
            else:
                out.append(Alternativa(o.id, o, o.nombre))
        return out

    def _rubros_que_pagan_mas(self) -> list[str]:
        pq, actual = self.cat.paquete, self.e["rubro"]
        filas = {f["rubro"]: float(f["p50"]) for f in pq.filas("esi_ingreso_rubro_edad") if f["banda_edad"] == "18-54" and f["p50"]}
        dominio = set(pq.variables["rubro"]["dominio"])
        if actual not in filas:
            return []
        mejores = sorted((r for r in filas if r in dominio and r != actual and filas[r] > filas[actual]), key=lambda r: -filas[r])
        return mejores[:3]

    def aplica(self, dec: Decision) -> bool:
        return bool(dec.cuando(self.e, _NULO)) and len(self.alternativas(dec)) >= (1 if dec.tipo == "forzada" else 2)

    def _decision_del_anio(self, excluir: set[str] = frozenset()) -> tuple[Decision | None, str]:
        e = self.e
        if not excluir:
            for dec in self.cat.forzadas:
                if self.aplica(dec):
                    return dec, "forzada"
        candidatas, pesos = [], []
        for dec in self.cat.cartas:
            if dec.id in excluir:
                continue
            if self._t - self._cartas_vistas.get(dec.id, -9) <= _SIN_REPETIR or not self.aplica(dec):
                continue
            w = dec.peso(e, _NULO) * dec.factor_peso
            if dec.id == "renunciar":
                w *= e["p_renuncia"]
            if w > 0:
                candidatas.append(dec)
                pesos.append(w)
        if not candidatas:
            return None, "carta"
        u = self._rng("carta").random() * sum(pesos)
        elegido = candidatas[-1]
        for dec, w in zip(candidatas, pesos):
            u -= w
            if u < 0:
                elegido = dec
                break
        self._cartas_vistas[elegido.id] = self._t
        return elegido, "carta"

    def _decidir(self, dec: Decision, origen: str) -> Generator[Pregunta, str, None]:
        alts = self.alternativas(dec)
        if not alts:
            return
        if dec.tipo == "interna":
            alt = alts[0]
        else:
            if dec.id in self._preguntadas:  # una misma decisión se pregunta a lo más una vez al año
                return
            self._preguntadas.add(dec.id)
            pregunta = Pregunta(self._t, dec, alts, origen)
            if self.auto is not None and self._decidio_jugador:
                # Una decisión por año: lo demás que surge ese año lo decide tu gemelo, como decides tú.
                respuesta, origen = self.auto(self, pregunta), "gemelo"
            else:
                respuesta = yield pregunta
                self._decidio_jugador = self._decidio_jugador or self.auto is not None
            alt = next((a for a in alts if a.id == respuesta), None)
            if alt is None:
                raise ValueError(f"opción {respuesta!r} no existe en {dec.id}; opciones: {[a.id for a in alts]}")
        if alt.decision is not None:  # una carta ofrecida dentro del mercado: se juega como esa decisión
            dec, alt = alt.decision, Alternativa(alt.id.split(":")[-1], alt.opcion, alt.nombre, alt.eleccion)
        if alt.eleccion:
            self.e.update(alt.eleccion)
        r = self._rng(f"dec:{dec.id}")
        res = self._sortear(dec.id, alt.opcion.resultados, r)
        self._aplicar(res, r)
        if alt.empleador is not None:
            self.empleador = alt.empleador
            self._empleador_nuevo = alt.empleador if self.detalle else None
        extra = {"oferta": alt.oferta} if alt.oferta else {}
        self._anotar("decision", dec.id, dec.nombre, res, alt.opcion.calidad, alt.opcion.fuentes, opcion=alt.id, opcion_nombre=alt.nombre, pregunta=dec.pregunta,
                     origen=origen, **extra)
        if res.luego:
            yield from self._luego(res.luego)
        yield from self._asegurar_empleador()

    def _asegurar_empleador(self) -> Generator[Pregunta, str, None]:
        """Quien vuelve a trabajar sin que el resultado diga dónde (bootcamp) pasa por el sorteo de empleador."""
        if self.e["estado"] == "empleado" and not self.e["tipo_empleador"]:
            yield from self._decidir(self.cat.decisiones["tipo_de_empleador"], "consecuencia")

    def _luego(self, destino: str) -> Generator[Pregunta, str, None]:
        dec = self.cat.decisiones.get(destino)
        if dec is not None:
            if dec.tipo == "interna" or dec.cuando(self.e, _NULO):
                yield from self._decidir(dec, "consecuencia")
            return
        ev = self.cat.evento_por_id.get(destino)
        if ev is not None:
            yield from self._evento(ev, forzar=True)

    # ------------------------------------------------------------------ eventos
    def _evento(self, ev: Evento, forzar: bool = False) -> Generator[Pregunta, str, None]:
        e = self.e
        if ev.id == "startup_cierra" and e["destino_startup"] and not forzar:
            return
        if ev.id == "oferta_llega" and self.auto is not None:
            return  # en la partida del jugador las ofertas llegan por el mercado de la temporada
        if not forzar and not ev.cuando(e, _NULO):
            return
        r = self._rng(f"ev:{ev.id}")
        u = r.random()
        if not forzar:
            p = ev.prob_anual(e, _NULO)
            if ev.id == "separacion_empleo":
                p *= self.cat.mundo.separacion(e, _NULO)
            if u >= p:
                return
        res = self._sortear(ev.id, ev.resultados, r)
        self._aplicar(res, r)
        if ev.id == "alza_anual":
            e["sueldo"] *= 1 + e["alza_extra_anual"] + self.cat.mundo.alza(e, _NULO)
        self._anotar("evento", ev.id, ev.nombre, res, ev.calidad, ev.fuentes)
        if res.luego:
            yield from self._luego(res.luego)
        yield from self._asegurar_empleador()

    def probabilidades(self, donde: str, resultados: list[Resultado]) -> list[float]:
        """Probabilidad de cada resultado en el estado actual, con los multiplicadores del mundo."""
        e = self.e
        ps: list[float | None] = []
        for res in resultados:
            if res.prob is None:
                ps.append(None)
                continue
            p = res.prob(e, _NULO)
            if (donde == "cesantia" and res.id == "encuentra") or (donde == "separacion_empleo" and res.id == "reemplea"):
                p = min(self.cat.juego["reglas_motor"]["tope_prob_encontrar"], p * e["p_encontrar"] * self.cat.mundo.encontrar(e, _NULO))
            ps.append(max(0.0, min(1.0, p)))
        explicito = sum(p for p in ps if p is not None)
        if explicito > 1:
            ps = [None if p is None else p / explicito for p in ps]
            explicito = 1.0
        return [max(0.0, 1 - explicito) if p is None else p for p in ps]

    def _sortear(self, donde: str, resultados: list[Resultado], r: Random) -> Resultado:
        if len(resultados) == 1:
            return resultados[0]
        u = r.random()
        for res, p in zip(resultados, self.probabilidades(donde, resultados)):
            u -= p
            if u < 0:
                return res
        return resultados[-1]

    def _aplicar(self, res: Resultado, r: Random) -> None:
        e = self.e
        estado_previo = e["estado"]
        empleo_previo = (e["estado"], e["tipo_empleador"])
        valores = [(ef, ef.valor(e, r)) for ef in res.efectos if ef.cuando is None or ef.cuando(e, r)]
        for ef, v in valores:
            previo = e[ef.var]
            if ef.op == "suma":
                e[ef.var] = previo + v
            elif ef.op == "multiplica":
                e[ef.var] = previo * v
            elif ef.op == "fija":
                e[ef.var] = v
            else:
                raise ValueError(f"operación desconocida: {ef.op}")
            if ef.duracion:
                self._temporales.append([ef.var, ef.op, v, previo, ef.duracion])
            if ef.var == "hueco" and e["hueco"]:
                self._edad_hueco = e["edad"]
        # Quien queda sin trabajo no tiene sueldo. Varios resultados del paquete (volver de
        # emigrar, bootcamp sin colocación, vender la empresa) cambian el estado sin tocarlo.
        if e["estado"] in ("buscando", "inactivo") and e["sueldo"] > 0:
            if estado_previo == "empleado":
                e["sueldo_ref"] = e["sueldo"]
            e["sueldo"] = 0
        self._acotar()
        self._derivar()
        if self.detalle and (e["estado"], e["tipo_empleador"]) != empleo_previo:
            self.empleador = self.empresa(e["tipo_empleador"]) if e["estado"] == "empleado" else None
            self._empleador_nuevo = self.empleador

    def _acotar(self) -> None:
        e = self.e
        for var, (lo, hi) in self.cat.limites.items():
            v = e.get(var)
            if v is not None and not lo <= v <= hi:
                e[var] = lo if v < lo else hi

    def _anotar(self, tipo: str, id_: str, nombre: str, res: Resultado, calidad: str, fuentes: list[str], **extra) -> None:
        self.hechos.add(f"{id_}/{res.id}")
        if self.detalle:
            self._bitacora.append(
                {"tipo": tipo, "id": id_, "nombre": nombre, "resultado": res.id, "texto": res.texto_al_ocurrir or res.texto, "tono": "neutro" if res.texto_al_ocurrir else res.tono,
                 "calidad": calidad, "fuentes": fuentes, "silencioso": id_ in _SILENCIOSOS, "empleador": self._empleador_nuevo, **extra}
            )
            self._empleador_nuevo = None

    def _nota_motor(self, id_: str, texto: str, tono: str) -> None:
        self.hechos.add(id_)
        if self.detalle:
            self._bitacora.append({"tipo": "evento", "id": id_, "nombre": texto, "resultado": id_, "texto": texto, "tono": tono,
                                   "calidad": "supuesto", "fuentes": ["equipo"], "silencioso": False})

    # ------------------------------------------------------------------ cierre
    def _cerrar(self) -> None:
        e, cat = self.e, self.cat
        # Lo vivido en el año, antes de que venzan los efectos de un año (horas extra, mudanza).
        ocupado_anio = e["estado"] in _OCUPADO
        horas_anio = e["horas"] if ocupado_anio else 0
        reglas = cat.juego["reglas_motor"]
        r = self._rng("cierre")

        # Relojes de la startup: el desenlace que se sorteó al entrar.
        if e["estado"] == "empleado" and e["tipo_empleador"] == "startup":
            e["anos_en_startup"] += 1
            if e["cierra_en"] > 0:
                e["cierra_en"] -= 1
                if e["cierra_en"] == 0:
                    ev = cat.evento_por_id["startup_cierra"]
                    self._aplicar(ev.resultados[0], r)
                    self._anotar("evento", ev.id, ev.nombre, ev.resultados[0], ev.calidad, ev.fuentes)
            elif e["exit_en"] > 0:
                e["exit_en"] -= 1
                if e["exit_en"] == 0:
                    e["ahorro"] += cat.venta_startup(e, r)
                    self._nota_motor("venta_startup", "Compran la startup: tus acciones pagan.", "bueno")
        if not (e["estado"] == "empleado" and e["tipo_empleador"] == "startup"):
            e["anos_en_startup"] = 0
            e["cierra_en"] = 0
            e["exit_en"] = 0
            e["destino_startup"] = 0

        # Salida del trabajo tras un hijo, y vuelta a buscar después de un año inactivo.
        if e["deja_de_trabajar"] and e["estado"] == "empleado":
            e["estado"], e["sueldo_ref"], e["sueldo"], e["hueco"] = "inactivo", e["sueldo"], 0, 1
            self._edad_hueco = e["edad"]
            self._nota_motor("deja_de_trabajar", "Dejas de trabajar para cuidar.", "neutro")
        e["deja_de_trabajar"] = 0
        if e["estado"] == "inactivo":
            self._anos_inactivo += 1
            if self._anos_inactivo > reglas["anos_inactivo"]:
                e["estado"], self._anos_inactivo = "buscando", 0
        else:
            self._anos_inactivo = 0

        # Ahorro del año.
        if e["sueldo"] > 0:
            e["ahorro"] += 12 * (e["sueldo"] * e["tasa_ahorro"] - (e["gasto_mensual"] - self._gasto_base))
        else:
            e["ahorro"] -= cat.costo_sin_ingreso(e, r)
        if e["ahorro"] > 0:
            e["ahorro"] *= 1 + cat.paquete.k("RETORNO_REAL")

        # Oficio, red y energía.
        if e["estado"] in _OCUPADO:
            e["skill"] += reglas["skill_por_ano_trabajado"] * e["aprendizaje"]
            e["red"] += reglas["red_por_ano_trabajado"]
        e["energia"] += (reglas["energia_base"] - e["energia"]) * reglas["energia_reversion"]

        # Contadores.
        if e["estado"] == "empleado":
            e["antiguedad"] += 1
            e["sueldo_ref"] = e["sueldo"]
        else:
            e["antiguedad"] = 0
        if e["estado"] != "buscando":
            e["meses_cesante"] = 0
        e["anos_titulado"] += 1
        if e["edad_hijo_menor"] >= 0:
            e["edad_hijo_menor"] += 1
        if e["hueco"] and self._edad_hueco is not None and e["edad"] - self._edad_hueco >= reglas["anos_hueco"] and e["estado"] in _OCUPADO:
            e["hueco"], self._edad_hueco = 0, None
        if e["estado"] == "buscando":
            self.hechos.add("ano_cesante")

        # Efectos con duración: vence el que llega a cero.
        vigentes = []
        for item in self._temporales:
            item[4] -= 1
            if item[4] > 0:
                vigentes.append(item)
                continue
            var, op, v, previo, _ = item
            if op == "suma":
                e[var] -= v
            elif op == "multiplica":
                if v:
                    e[var] /= v
            else:
                e[var] = previo
        self._temporales = vigentes

        self._acotar()
        self._derivar()
        ind = indicadores(cat, e)
        registro = {
            "t": self._t,
            "edad": e["edad"],
            "estado": e["estado"],
            "sueldo": e["sueldo"],
            "ahorro": e["ahorro"],
            "recesion": self._recesion,
            "indicadores": ind,
            "felicidad": felicidad(ind, self.prioridades),
        }
        if self.detalle:
            registro.update(self._como_fue_el_anio(ind, horas_anio))
            registro.update(
                tipo_empleador=e["tipo_empleador"], rubro=e["rubro"], nivel=e["nivel"], edu=e["edu"], pareja=e["pareja"],
                hijos=e["hijos"], empleador=self.empleador if e["estado"] == "empleado" else None, percentil=e["percentil"] if e["sueldo"] > 0 else None, sueldo_inicio=self._sueldo_inicio,
                eventos=self._bitacora,
            )
        self.anios.append(registro)
        e["edad"] += 1

    # ------------------------------------------------------------------ cómo se ve el año
    def _como_fue_el_anio(self, ind: dict, horas: float) -> dict:
        """Lo que la pantalla necesita para contar el año: el tono y, si hubo, el momento duro con su cifra."""
        e, pq = self.e, self.cat.paquete
        hechos = {(x["id"], x["resultado"]) for x in self._bitacora}
        malos = [x for x in self._bitacora if x["tono"] == "malo" and x["id"] in _PESADOS]
        caida = max(self._ind_inicio["bienestar"] - ind["bienestar"], self._ind_inicio["vida_personal"] - ind["vida_personal"])

        momento = None
        if ("separacion_empleo", "cesante") in hechos:
            momento = {"tipo": "despido", "valor": pq.k("MESES_CESANTIA", e["banda3"]), "unidad": "meses",
                       "texto": "dura en promedio la búsqueda de trabajo para alguien de tu edad", "fuente": "Encuesta de Protección Social 2024"}
        elif ("startup_cierra", "cierra") in hechos:
            momento = {"tipo": "cierre_startup", "valor": round(pq.k("YC_CERRADA") * 100), "unidad": "%",
                       "texto": "de las startups de Y Combinator de 2012 a 2019 ya cerró", "fuente": "Directorio de Y Combinator"}
        elif ("seguir_con_tu_empresa", "cierra") in hechos:
            momento = {"tipo": "cierre_empresa", "valor": round((1 - pq.k("SOBREVIVE_5")) * 100), "unidad": "%",
                       "texto": "de las empresas nuevas en Chile cierra antes de cumplir cinco años", "fuente": "INE, Registro Estadístico de Empresas"}
        elif ("licencia_salud_mental", "colapsa") in hechos or ("licencia_salud_mental", "rechazada") in hechos:
            sistema = "isapre" if e["isapre"] else "fonasa"
            momento = {"tipo": "salud_mental", "valor": round(pq.k("LICENCIA_RECHAZO", sistema) * 100, 1), "unidad": "%",
                       "texto": f"de las licencias por salud mental se rechaza en {'las isapres' if e['isapre'] else 'Fonasa'}", "fuente": "Superintendencia de Seguridad Social 2024"}

        viaje = ("sabatico", "vuelve_bien") in hechos or ("sabatico", "cuesta_volver") in hechos
        noche = not viaje and (bool(malos) or momento is not None or horas >= 55 or caida >= 8 or e["estado"] in ("buscando", "inactivo"))
        return {
            "tono": "noche" if noche else "dia",
            "momento": momento,
            "horas": horas,
            "indicadores_inicio": self._ind_inicio,
        }

    def vista_previa(self, decision_id: str, alt: "Alternativa") -> dict:
        """Qué mueve esta opción, para las etiquetas de la carta («+ Dinero», «− Vida personal», «Sale bien 5 de 10»).

        Aplica cada resultado posible a una copia del estado y pondera por su probabilidad. Mira solo
        el efecto inmediato y lo traduce a puntos aproximados por barra:
        Dinero = % de cambio del sueldo + ahorro en meses de gasto; Carrera = oficio, red, nivel y
        seguir con trabajo; Bienestar = energía y ánimo; Vida personal = tiempo con tu gente y horas.
        """
        previo = {k: self.e.get(k) for k in (alt.eleccion or {})}
        self.e.update(alt.eleccion or {})
        try:
            a = self.e
            probs = self.probabilidades(alt.decision.id if alt.decision else decision_id, alt.opcion.resultados)
            punt = dict.fromkeys(NOMBRES, 0.0)
            acum = {"p_bueno": 0.0, "p_malo": 0.0, "p_sin_pega": 0.0}
            for i, (res, p_res) in enumerate(zip(alt.opcion.resultados, probs)):
                if p_res <= 0:
                    continue
                for tiro in range(_TIROS_PREVIA):  # varios tiros: los efectos con azar (alzas de 5% a 25%) se promedian
                    p = p_res / _TIROS_PREVIA
                    otra = copy.copy(self)
                    otra.e = dict(a)
                    otra._temporales = [list(x) for x in self._temporales]
                    otra.detalle = False
                    otra.hechos = set()
                    otra._aplicar(res, _flujo(self.semilla, self.indice, self._t, f"previa:{alt.id}:{i}:{tiro}"))
                    self._puntuar(a, otra.e, res, p, punt, acum)
        finally:
            self.e.update(previo)
        return {"puntos": {k: round(v, 1) for k, v in punt.items()}, **{k: round(v, 3) for k, v in acum.items()}}

    @staticmethod
    def _puntuar(a: dict, d: dict, res: Resultado, p: float, punt: dict, acum: dict) -> None:
        sueldo = (d["sueldo"] / a["sueldo"] - 1) if a["sueldo"] > 0 else (0.3 if d["sueldo"] > 0 else 0)
        ahorro_meses = (d["ahorro"] - a["ahorro"]) / max(a["gasto_mensual"], 1)
        sin_pega = a["estado"] in _OCUPADO and d["estado"] not in _OCUPADO
        punt["dinero"] += p * (100 * sueldo + 0.8 * ahorro_meses)
        punt["carrera"] += p * ((d["skill"] - a["skill"]) + 0.5 * (d["red"] - a["red"]) + 10 * (d["nivel"] - a["nivel"]) - (15 if sin_pega else 0))
        punt["bienestar"] += p * (0.5 * (d["energia"] - a["energia"]) + (d["animo"] - a["animo"]))
        punt["vida_personal"] += p * (60 * (d["tiempo_con_tu_gente"] - a["tiempo_con_tu_gente"]) - 0.5 * (d["horas"] - a["horas"]))
        acum["p_bueno"] += p if res.tono == "bueno" else 0
        acum["p_malo"] += p if res.tono == "malo" else 0
        acum["p_sin_pega"] += p if sin_pega else 0

    # ------------------------------------------------------------------ resumen
    def felicidad(self) -> float:
        return sum(a["felicidad"] for a in self.anios) / len(self.anios) if self.anios else 0.0
