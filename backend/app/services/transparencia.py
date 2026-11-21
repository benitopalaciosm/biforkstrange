"""De dónde sale cada número: parámetros, fuentes y supuestos, para mostrarlos en el juego."""

from __future__ import annotations

from collections import Counter

from app.sim.catalogo import cargar_juego, cargar_mundos, catalogo
from app.sim.paquete import paquete_base


def catalogo_formulario(claude: bool, transporte: str | None = None) -> dict:
    pq = paquete_base()
    juego = cargar_juego()
    return {
        "rubros": [r for r in pq.variables["rubro"]["dominio"] if r and r != "Administración pública"],
        "areas": [a for a in pq.variables["area"]["dominio"] if a],
        "carreras": [
            {"id": int(f["carrera_id"]), "nombre": f["carrera"], "area": f["area"], "tipo_institucion": f["tipo_institucion"]}
            for f in pq.filas("mifuturo_carreras")
        ],
        "niveles": ["Junior", "Semi senior", "Senior", "Jefatura", "Gerencia"],
        "mundos": [{k: m[k] for k in ("id", "nombre", "descripcion", "ciclo", "tecnologia")} for m in cargar_mundos()["mundos"]],
        "horizonte_anios": juego["horizonte_anios"],
        "politica_base": {d: {o: v[0] for o, v in ops.items()} for d, ops in juego["politica"]["opciones"].items()},
        "decisiones": {d.id: {"pregunta": d.pregunta, "opciones": {o.id: o.nombre for o in d.opciones}} for d in catalogo("estable_parecido").decisiones.values() if d.tipo != "interna"},
        "claude": claude,
        "claude_transporte": transporte,
    }


def fuentes() -> dict:
    pq = paquete_base()
    juego = cargar_juego()
    cat = catalogo("estable_parecido")
    parametros = [
        {"id": p["id"], "descripcion": p["descripcion"], "valor": p["valor"], "unidad": p["unidad"], "rango": p.get("rango"),
         "calidad": p["calidad"], "fuente": pq.fuentes.get(p["fuente"], {"cita": "Supuesto del equipo", "url": None}) | {"id": p["fuente"]}}
        for p in pq.meta_parametros.values()
    ]
    opciones = [o for d in cat.decisiones.values() if d.tipo != "interna" for o in d.opciones]
    return {
        "resumen": {
            "parametros": dict(Counter(p["calidad"] for p in parametros)),
            "decisiones_en_juego": sum(1 for d in cat.decisiones.values() if d.tipo != "interna"),
            "opciones_por_calidad": dict(Counter(o.calidad for o in opciones)),
            "eventos_en_juego": len(cat.eventos) + len(cat.eventos_mundo),
            "tablas": len(pq.indice),
            "fuentes": len(pq.fuentes),
        },
        "parametros": parametros,
        "supuestos_del_juego": {
            "reglas_motor": juego["reglas_motor"],
            "indicadores": juego["indicadores"],
            "politica": juego["politica"]["nota"],
            "parches": [{"donde": f"{p['decision']} / {p['opcion']} / {p['resultado']}", "motivo": p["motivo"]} for p in juego["parches"]],
            "excluido": juego["excluido"],
            "mundos": cargar_mundos(),
        },
    }
