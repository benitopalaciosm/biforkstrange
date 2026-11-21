# Trayectoria laboral v1: tickets

Rama: `feat/trayectoria-ultimo-trabajo`.

**Qué ve la persona.** Dice su edad y de qué tipo fue su último trabajo. El simulador le responde tres cosas con datos: qué tan probable es que ese trabajo termine este año, cuánto suele durar, y a qué tipo de trabajo pasa después. Luego puede simular varios años y ver cómo se reparten sus gemelos entre tipos de trabajo.

**De dónde salen los números.** Cinco tablas del paquete `datos_laborales/simulador/tablas`, copiadas a `backend/app/sim/data/`:

| Tabla | Fuente | Responde |
|---|---|---|
| `eps_terminos_empleo` | EPS 2024, Chile | ¿Termina tu empleo este año? ¿Pasas directo a otro, a cesantía o a inactividad? |
| `eps_cesantia_duracion` | EPS 2024, Chile | Si quedas cesante, ¿cuánto tardas en volver? |
| `jobhop_transiciones` | CVs de Flandes | ¿A qué grupo ocupacional pasas según el último? |
| `jobhop_cambio_grupo` | CVs de Flandes | ¿Cambias de ocupación específica? |
| `jobhop_duracion` | CVs de Flandes | ¿Cuánto dura un empleo en tu grupo? |

## Tickets

| # | Ticket | Archivos | Listo cuando | Estado |
|---|---|---|---|---|
| T1 | Cargar las tablas | `sim/tables.py`, `sim/data/*.csv` | Las tablas quedan como arrays por tramo de edad y grupo; un test revisa que la matriz sume 1 y calce con la tabla de cambio de grupo | Hecho |
| T2 | Paso laboral anual | `sim/labor.py`, `sim/state.py`, `sim/engine.py` | Cada año, cada gemelo sigue, cambia de empleo, cae en cesantía o vuelve; el grupo nuevo se sortea con la matriz. Tests comparan las frecuencias con las tablas | Hecho |
| T3 | Decisiones sobre la base real | `sim/decisions/*` | Las decisiones ya no inventan el riesgo de cesantía: multiplican el de la EPS. "Cambiar de pega" fuerza el cambio | Hecho |
| T4 | Métricas y API | `sim/metrics.py`, `schemas/`, `api/routes/ocupaciones.py` | `GET /api/ocupaciones`, `GET /api/ocupaciones/{grupo}?edad=`, y cada año de la simulación trae cambio de empleo, antigüedad y reparto por grupo | Hecho |
| T5 | Usarlo desde el terminal | `app/cli.py`, `tests/test_cli.py`, `Makefile` | `make perfil` y `make simular` muestran tablas legibles sin levantar el servidor | Pendiente |
| T6 | Pantalla básica | `frontend/src/features/simulation/*` | Eliges edad y tipo de trabajo, ves el perfil y, al simular, el reparto por año. `npm run build` compila | Pendiente |
| T7 | Validar contra Chile | `sim/validation.py`, `tests/test_validation.py`, `docs/trayectoria-v1/VALIDACION.md` | El motor se compara con datos chilenos que no usó (panel ELSOC y metas del paquete) y el informe muestra qué cuadra y qué no | Pendiente |
| T8 | Revisión independiente | — | Alguien que no escribió el código lo revisa buscando errores de lógica y de estadística; lo que encuentre se corrige o se anota | Pendiente |
| T9 | Aplicar el feedback de T7 y T8 | los que toque | Tests en verde después de los ajustes; `DEV.md` actualizado | Pendiente |

## Límites conocidos

- Los grupos ocupacionales son 10 (ISCO a 1 dígito). "Profesionales" junta a una contadora con un ingeniero.
- Las tablas de JobHop son de Flandes. De ellas solo se usa el destino del cambio y la diferencia relativa de duración entre grupos; la tasa base es chilena.
- La inactividad se trata igual que la cesantía.
- `growth`, `riesgo_rel` y `wear` de cada decisión siguen siendo de relleno.
