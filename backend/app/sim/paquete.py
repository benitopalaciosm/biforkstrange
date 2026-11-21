"""Carga el paquete de datos (`data/simulador`) y compila sus expresiones.

El paquete trae las reglas como datos: decisiones, eventos, parámetros y tablas, con
probabilidades y efectos escritos en un lenguaje de expresiones chico (ver
`data/simulador/README.md`). Este módulo es el único que conoce ese formato.

Cada expresión se traduce una vez a una función Python `f(estado, azar)`. La semántica es
la del evaluador de referencia (`data/simulador/referencia/expresiones.py`); un test
compara ambos sobre todo el catálogo.
"""

from __future__ import annotations

import ast
import csv
import json
import math
from collections.abc import Callable
from functools import lru_cache
from pathlib import Path
from random import Random
from typing import Any

RAIZ = Path(__file__).resolve().parents[2] / "data" / "simulador"

FUNCIONES = {
    "si", "y", "o", "no", "en", "min", "max", "clamp", "exp", "ln", "pow", "abs", "redondear",
    "k", "tabla", "tabla_o", "q_muerte", "luto", "falso",
    "azar", "azar_uniforme", "azar_normal", "azar_lognormal", "azar_entero",
}
_BIN = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Mod)
_CMP = (ast.Lt, ast.LtE, ast.Gt, ast.GtE, ast.Eq, ast.NotEq)
_BANDAS7 = ["18-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54"]
_CUANTILES = [(0.10, "p10"), (0.25, "p25"), (0.50, "p50"), (0.75, "p75"), (0.90, "p90")]

Expresion = Callable[[dict, Random], Any]


class ErrorExpresion(Exception):
    pass


def _clave(v: Any) -> str:
    if isinstance(v, float) and v.is_integer():
        v = int(v)
    return str(v)


class _Traductor(ast.NodeTransformer):
    """Reescribe una expresión del paquete como una expresión Python sobre `e`, `R` y `F`."""

    def visit_Name(self, n: ast.Name) -> ast.AST:
        return ast.Subscript(value=ast.Name("e", ast.Load()), slice=ast.Constant(n.id), ctx=ast.Load())

    def visit_Compare(self, n: ast.Compare) -> ast.AST:
        if len(n.ops) != 1:
            raise ErrorExpresion("comparación encadenada: usa y()")
        self.generic_visit(n)
        return ast.IfExp(test=n, body=ast.Constant(1), orelse=ast.Constant(0))

    def visit_Call(self, n: ast.Call) -> ast.AST:
        if not isinstance(n.func, ast.Name) or n.func.id not in FUNCIONES or n.keywords:
            raise ErrorExpresion(f"función no permitida: {ast.dump(n.func)}")
        f = n.func.id
        args = [self.visit(a) for a in n.args]
        uno, cero = ast.Constant(1), ast.Constant(0)
        # Perezosas, igual que en la referencia.
        if f == "si":
            return ast.IfExp(test=args[0], body=args[1], orelse=args[2])
        if f == "y":
            return ast.IfExp(test=ast.BoolOp(ast.And(), args) if len(args) > 1 else args[0], body=uno, orelse=cero)
        if f == "o":
            return ast.IfExp(test=ast.BoolOp(ast.Or(), args) if len(args) > 1 else args[0], body=uno, orelse=cero)
        if f == "no":
            return ast.IfExp(test=args[0], body=cero, orelse=uno)
        extra: list[ast.AST] = []
        if f.startswith("azar"):
            extra = [ast.Name("R", ast.Load())]
        elif f == "luto":
            extra = [ast.Name("e", ast.Load())]
        return ast.Call(
            func=ast.Attribute(value=ast.Name("F", ast.Load()), attr=f, ctx=ast.Load()),
            args=extra + args,
            keywords=[],
        )


def _validar(arbol: ast.Expression, fuente: str) -> None:
    permitidos = (ast.Expression, ast.Load, ast.Name, ast.Constant, ast.Call, ast.UnaryOp, ast.USub, ast.UAdd, ast.BinOp, ast.Compare)
    for n in ast.walk(arbol):
        if not (isinstance(n, permitidos) or isinstance(n, _BIN) or isinstance(n, _CMP)):
            raise ErrorExpresion(f"sintaxis no permitida: {type(n).__name__} en {fuente!r}")
        if isinstance(n, ast.Constant):
            if isinstance(n.value, bool) or not isinstance(n.value, (int, float, str)):
                raise ErrorExpresion(f"constante no permitida en {fuente!r}")
            if isinstance(n.value, str) and '"' in fuente:
                raise ErrorExpresion("usa comillas simples")


class _Funciones:
    """Funciones del lenguaje. Las `azar*` reciben el generador como primer argumento."""

    def __init__(self, paquete: "Paquete"):
        self._p = paquete
        self.k = paquete.k
        self.tabla = paquete.tabla
        self.q_muerte = paquete.q_muerte

    @staticmethod
    def en(x, *valores):
        return 1 if x in valores else 0

    @staticmethod
    def min(*a):
        return min(a)

    @staticmethod
    def max(*a):
        return max(a)

    @staticmethod
    def clamp(x, lo, hi):
        return max(lo, min(hi, x))

    exp = staticmethod(math.exp)
    ln = staticmethod(math.log)
    abs = staticmethod(abs)
    redondear = staticmethod(round)

    @staticmethod
    def pow(a, b):
        return a**b

    @staticmethod
    def falso():
        return 0

    def tabla_o(self, respaldo, *args):
        try:
            return self._p.tabla(*args)
        except ErrorExpresion:
            return respaldo

    def luto(self, e, quien, anos):
        per = "ano_0" if anos <= 0 else "ano_1" if anos == 1 else "anos_2_3" if anos <= 3 else "anos_4_5" if anos <= 5 else None
        if per is None:
            return 0
        t = lambda col: self._p.tabla("duelo_satisfaccion", col, "fallece", quien, "periodo", per)  # noqa: E731
        return min(0, t("base_hija_46") + t("por_ano_de_edad") * (e["edad"] - 46) + t("si_es_hijo_hombre") * (1 if e["sexo"] == "h" else 0))

    @staticmethod
    def azar(r: Random):
        return r.random()

    @staticmethod
    def azar_uniforme(r: Random, a, b):
        return r.uniform(a, b)

    @staticmethod
    def azar_normal(r: Random):
        return r.gauss(0, 1)

    @staticmethod
    def azar_entero(r: Random, a, b):
        return r.randint(int(a), int(b))

    @staticmethod
    def azar_lognormal(r: Random, p10, p50, p90):
        s = (math.log(p90) - math.log(p10)) / (2 * 1.2816)
        return math.exp(math.log(p50) + s * r.gauss(0, 1))


class Paquete:
    """Datos del simulador más un juego de parámetros (el de base o el de un mundo)."""

    def __init__(self, raiz: Path = RAIZ, parametros: dict[str, Any] | None = None, _base: "Paquete | None" = None):
        self.raiz = raiz
        if _base is None:
            carga = lambda f: json.loads((raiz / f).read_text(encoding="utf-8"))  # noqa: E731
            self.meta_parametros: dict[str, dict] = {p["id"]: p for p in carga("parametros.json")["parametros"]}
            self.indice: dict[str, dict] = {t["tabla"]: t for t in carga("tablas/indice.json")["tablas"]}
            self.decisiones: dict[str, dict] = {d["id"]: d for d in carga("decisiones.json")["decisiones"]}
            self.eventos: dict[str, dict] = {x["id"]: x for x in carga("eventos.json")["eventos"]}
            self.variables: dict[str, dict] = {v["nombre"]: v for v in carga("estado.json")["variables"]}
            self.fuentes: dict[str, dict] = {f["id"]: f for f in carga("fuentes.json")["fuentes"]}
            self.objetivos: list[dict] = carga("objetivos_validacion.json")["objetivos"]
            self._tablas: dict[str, list[dict]] = {}
            self._cache_tabla: dict[tuple, Any] = {}
            self._fuentes_expr: dict[str, Expresion] = {}
            self.valores: dict[str, Any] = {i: p["valor"] for i, p in self.meta_parametros.items()}
        else:
            # Un mundo comparte tablas y catálogo con el paquete base; solo cambia parámetros.
            for attr in ("meta_parametros", "indice", "decisiones", "eventos", "variables", "fuentes", "objetivos", "_tablas", "_cache_tabla"):
                setattr(self, attr, getattr(_base, attr))
            self._fuentes_expr = {}
            self.valores = dict(_base.valores)
        for pid, valor in (parametros or {}).items():
            if pid not in self.valores:
                raise ErrorExpresion(f"parámetro desconocido: {pid}")
            actual = self.valores[pid]
            self.valores[pid] = {**actual, **valor} if isinstance(actual, dict) and isinstance(valor, dict) else valor
        self._F = _Funciones(self)
        self._exposicion_area: dict[str, float] | None = None

    def con_parametros(self, parametros: dict[str, Any]) -> "Paquete":
        return Paquete(self.raiz, parametros, _base=self)

    # ------------------------------------------------------------------ datos
    def filas(self, nombre: str) -> list[dict]:
        if nombre not in self._tablas:
            if nombre not in self.indice:
                raise ErrorExpresion(f"tabla desconocida: {nombre}")
            with open(self.raiz / self.indice[nombre]["archivo"], encoding="utf-8") as fh:
                self._tablas[nombre] = list(csv.DictReader(fh))
        return self._tablas[nombre]

    def tabla(self, nombre: str, columna: str, *pares: Any) -> Any:
        clave = (nombre, columna) + tuple(_clave(v) for v in pares)
        try:
            val = self._cache_tabla[clave]
        except KeyError:
            val = self._cache_tabla[clave] = self._buscar(nombre, columna, pares)
        if isinstance(val, ErrorExpresion):
            raise val
        return val

    def _buscar(self, nombre: str, columna: str, pares: tuple) -> Any:
        cond = [(pares[i], _clave(pares[i + 1])) for i in range(0, len(pares), 2)]
        for f in self.filas(nombre):
            if all(_clave(f.get(c, "")) == v for c, v in cond):
                txt = f.get(columna, "")
                if txt == "":
                    return ErrorExpresion(f"celda vacía: {nombre}.{columna} con {dict(cond)}")
                try:
                    return float(txt)
                except ValueError:
                    return txt
        return ErrorExpresion(f"sin fila: {nombre} con {dict(cond)}")

    def k(self, nombre: str, clave: Any = None, defecto: Any = None) -> Any:
        try:
            v = self.valores[nombre]
        except KeyError:
            raise ErrorExpresion(f"parámetro desconocido: {nombre}") from None
        if clave is None:
            return v
        if isinstance(v, list):
            return v[int(clave)]
        c = _clave(clave)
        if c in v:
            return v[c]
        if defecto is not None:
            return defecto
        raise ErrorExpresion(f"clave {c!r} no está en {nombre}")

    def q_muerte(self, edad: float, sexo: str) -> float:
        a, b = self.k("MORT_GOMPERTZ", sexo)
        return min(0.6, math.exp(a + b * edad))

    # ------------------------------------------------------------------ expresiones
    def compilar(self, expr: Any) -> Expresion:
        """Devuelve `f(estado, azar)`. Los números se devuelven tal cual."""
        if isinstance(expr, bool) or not isinstance(expr, (int, float, str)):
            raise ErrorExpresion(f"expresión no válida: {expr!r}")
        if isinstance(expr, (int, float)):
            return lambda e, R, _v=expr: _v
        f = self._fuentes_expr.get(expr)
        if f is None:
            f = self._fuentes_expr[expr] = self._compilar(expr)
        return f

    def _compilar(self, expr: str) -> Expresion:
        try:
            arbol = ast.parse(expr, mode="eval")
        except SyntaxError as x:
            raise ErrorExpresion(f"no se puede leer {expr!r}: {x}") from None
        _validar(arbol, expr)
        cuerpo = _Traductor().visit(arbol.body)
        fn = ast.Expression(
            ast.Lambda(
                args=ast.arguments(posonlyargs=[], args=[ast.arg("e"), ast.arg("R")], kwonlyargs=[], kw_defaults=[], defaults=[]),
                body=cuerpo,
            )
        )
        ast.fix_missing_locations(fn)
        return eval(compile(fn, f"<expr {expr[:40]}>", "eval"), {"F": self._F, "__builtins__": {}})  # noqa: S307

    def evaluar(self, expr: Any, estado: dict, azar: Random | None = None) -> Any:
        try:
            return self.compilar(expr)(estado, azar or Random(0))
        except KeyError as x:
            raise ErrorExpresion(f"variable sin valor: {x.args[0]} en {expr!r}") from None

    # ------------------------------------------------------------------ derivadas
    def exposicion_area(self, area: str) -> float | None:
        if self._exposicion_area is None:
            self._exposicion_area = {}
            for f in self.filas("mifuturo_carreras"):
                self._exposicion_area.setdefault(f["area"], float(f["exposicion_ia_area"]))
        return self._exposicion_area.get(area)

    def derivar(self, e: dict) -> dict:
        """Recalcula en `e` las variables con `inicio: deriva` de estado.json.

        Dos extensiones sobre la referencia, para gemelos creados desde un CV sin carrera
        exacta: la exposición a IA sale del área de estudios si no hay `carrera_id`, y sin
        carrera el alza de los primeros años usa el perfil de la ESI.
        """
        x = e["edad"]
        e["mujer"] = 1 if e["sexo"] == "m" else 0
        e["sexo_txt"] = "mujer" if e["sexo"] == "m" else "hombre"
        e["edu_esi"] = "media_o_menos" if e["edu"] == "media" else e["edu"]
        e["banda3"] = "18-29" if x < 30 else "30-44" if x < 45 else "45-59"
        e["banda7"] = "18-24" if x < 25 else "50-54" if x >= 50 else f"{5 * (x // 5)}-{5 * (x // 5) + 4}"
        e["banda5"] = "15-19" if x < 20 else "45-49" if x >= 45 else f"{5 * (x // 5)}-{5 * (x // 5) + 4}"
        cid = e.get("carrera_id", -1)
        if cid >= 0:
            e["exposicion_ia"] = self.tabla("mifuturo_carreras", "exposicion_ia_area", "carrera_id", cid)
        else:
            por_area = self.exposicion_area(e.get("area", ""))
            e["exposicion_ia"] = por_area if por_area is not None else 0.143
        e["estamento"] = {"media": "Administrativos", "tecnica": "Técnicos"}.get(e["edu"], "Profesionales")
        e["seniority"] = ["Junior", "Semi Senior", "Senior", "Expert", "Expert"][int(e.get("nivel", 0))]
        e["region_nombre"] = "Metropolitana" if e.get("region", "rm") == "rm" else e.get("region_perfil", "Valparaíso")
        e["percentil"] = self.percentil(e)
        e["quintil"] = ["I", "II", "III", "IV", "V"][min(4, int(e["percentil"] // 20))]
        e["pareja_previa"] = e.get("pareja", "no")
        e["crecimiento_esi"] = self._crecimiento_esi(e["edu"], e["banda7"])
        e["crecimiento_carrera"] = self._crecimiento_carrera(e) if cid >= 0 else e["crecimiento_esi"]
        return e

    def cuantiles_esi(self, edu: str, banda7: str) -> list[float]:
        return list(self._cuantiles_esi(edu, banda7))

    @lru_cache(maxsize=None)  # noqa: B019 - el paquete vive todo el proceso
    def _cuantiles_esi(self, edu: str, banda7: str) -> tuple[float, ...]:
        return tuple(self.tabla("esi_perfil_edad_edu", c, "educacion", edu, "banda", banda7) for _, c in _CUANTILES)

    def percentil(self, e: dict) -> float:
        """Percentil del sueldo dentro de su edad y educación (ESI 2025). 50 si no hay sueldo."""
        s = e.get("sueldo")
        if not s:
            return 50
        v = self._cuantiles_esi(e["edu"], e["banda7"])
        if s <= v[0]:
            return max(1, round(10 * s / v[0]))
        for i in range(4):
            if s <= v[i + 1]:
                q0, q1 = _CUANTILES[i][0], _CUANTILES[i + 1][0]
                if v[i + 1] == v[i]:
                    return round(100 * q1)
                return round(100 * (q0 + (q1 - q0) * (s - v[i]) / (v[i + 1] - v[i])))
        return min(99, round(90 + 10 * (s - v[4]) / v[4]))

    @lru_cache(maxsize=None)  # noqa: B019
    def _crecimiento_esi(self, edu: str, banda7: str) -> float:
        i = _BANDAS7.index(banda7)
        if i == len(_BANDAS7) - 1:
            return 0
        a = self.tabla("esi_perfil_edad_edu", "p50", "educacion", edu, "banda", _BANDAS7[i])
        b = self.tabla("esi_perfil_edad_edu", "p50", "educacion", edu, "banda", _BANDAS7[i + 1])
        return max(0, min(0.06, (b / a) ** (1 / 5) - 1))

    def _crecimiento_carrera(self, e: dict) -> float:
        cid, t = e["carrera_id"], e.get("anos_titulado", 9)
        if t >= 4:
            return 0
        a = self.tabla("mifuturo_carreras", f"ingreso_bruto_ano{t + 1}", "carrera_id", cid)
        b = self.tabla("mifuturo_carreras", f"ingreso_bruto_ano{t + 2}", "carrera_id", cid)
        return max(0, min(0.2, b / a - 1))


@lru_cache
def paquete_base() -> Paquete:
    return Paquete()
