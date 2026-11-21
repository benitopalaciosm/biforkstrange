# BiforkStrange: desarrollo

## Arranque

```bash
cp backend/.env.example backend/.env      # opcional: ANTHROPIC_API_KEY, SUPABASE_URL y SUPABASE_SERVICE_KEY
cp frontend/.env.example frontend/.env    # VITE_API_URL
make install
make back    # http://localhost:8000/docs
make front   # http://localhost:5173
make test
```

Sin credenciales de Supabase el backend guarda las comparaciones en memoria.

Claude tiene dos transportes (`backend/app/core/llm.py`). Con `ANTHROPIC_API_KEY` usa la API. Sin key, si tienes Claude Code instalado, usa `claude -p` con Sonnet y tu sesión local: sirve para desarrollar sin key, no para el deploy. Sin ninguno de los dos el juego funciona completo con plantillas. Para apagar el transporte local: `CLAUDE_CLI=false` en `backend/.env`.

## Cómo funciona

Tres piezas:

1. **Datos** (`backend/data/simulador/`): el paquete con las reglas como datos. Decisiones, eventos, parámetros y tablas, con probabilidades y efectos escritos en un lenguaje de expresiones chico. Cada número declara su fuente y su calidad (`dato`, `mixto`, `supuesto`). Su `README.md` explica el formato. No se edita a mano: se regenera desde los microdatos.
2. **Juego** (`backend/data/juego.json` y `mundos.json`): qué parte del paquete se usa, los parches con su motivo, las reglas que agrega el motor al cerrar el año, la fórmula de las cuatro barras, la política de los gemelos que juegan solos, las bifurcaciones y los cuatro mundos. Todo lo que está ahí es decisión del equipo.
3. **Motor** (`backend/app/sim/`): un intérprete genérico de esas reglas. Agregar una decisión es agregar un bloque JSON al paquete y su id a `juego.json`.

Un año del motor: se sortea la recesión → la decisión del año (la bifurcación el primer año; después una forzada o una carta sorteada por peso) → los eventos (despido, ascenso, oferta, alza de sueldo…) → el cierre (ahorro, energía, antigüedad, efectos que vencen).

El motor es determinista dada `(semilla, índice)`. Cada sorteo usa un flujo propio derivado de `(semilla, índice, año, clave)`, así que la vida 37 del camino A y la del camino B viven el mismo mundo: su diferencia viene de la decisión, no de la suerte.

La API no guarda partidas. Una partida es `(perfil, mundo, semilla, elecciones)` y se recalcula entera en cada turno.

Claude construye el gemelo y cuenta su historia; nunca calcula (`backend/app/services/claude_service.py`):

- `POST /api/gemelo/leer`: del CV y de lo que la persona cuenta de sí salen el perfil, la identidad en prosa (`gemelo_md`) y su **política**: la probabilidad de que esa persona elija cada opción de cada decisión. Los gemelos que juegan solos deciden con ella, mezclada 60/40 con la frecuencia de la gente en general (`politica.peso_gemelo` en `juego.json`).
- `POST /api/historia`: en cada turno narra el año que el motor ya calculó y escribe la próxima decisión a la medida. La carta de Claude se descarta si no trae exactamente las opciones del motor.
- `POST /api/epilogo`: la década contada de corrido y el CV del año final.

El servidor no guarda la identidad: el front la manda en cada petición.

Las cartas y la narración pueden nombrar empleadores reales (`backend/app/sim/empresas.py`, datos en `backend/data/empresas/`): startups chilenas de Y Combinator, concursos del Servicio Civil y vacantes de Get on Board. No mueven ningún número, y el prompt prohíbe nombrarlos en hechos negativos (cierres, despidos).

## Backend (`backend/app`)

Las dependencias van en una sola dirección: `api → services → (sim, repositories)`.

| Capa | Qué contiene |
|---|---|
| `sim/paquete.py` | Carga el paquete y compila sus expresiones a funciones Python. Un test lo compara con el evaluador de referencia del paquete. |
| `sim/catalogo.py` | Arma el catálogo de un mundo: decisiones y eventos en juego, parches aplicados, multiplicadores del mundo. |
| `sim/motor.py` | `Vida`: el ciclo anual. Es un generador que entrega una `Pregunta` cada vez que hay que elegir. |
| `sim/gemelo.py` | Del perfil de la persona al estado inicial. |
| `sim/empresas.py` | Empleadores y vacantes reales para el contexto de la historia. |
| `sim/indicadores.py` | Las cuatro barras y la felicidad. |
| `sim/montecarlo.py` | Política de los gemelos, reproducción de una partida jugada y comparación de dos caminos. |
| `sim/calibracion.py` | Cohorte simulada contra los objetivos de la ESI y la EPS. |
| `schemas/` | Modelos Pydantic de entrada de la API. |
| `services/` | Casos de uso: `juego_service` (gemelo, turno, comparación y sus frases), `claude_service`, `transparencia`. |
| `repositories/` | Persistencia detrás de un `Protocol`: Supabase o memoria. Guarda las comparaciones. |
| `api/` | Rutas delgadas. `deps.py` es el único lugar que elige implementaciones. |
| `core/` | Configuración y clientes externos: Supabase y `llm.py` (Claude por API o por Claude Code local). |

### API

| Ruta | Qué hace |
|---|---|
| `GET /api/catalogo` | Opciones del formulario y mundos. |
| `POST /api/gemelo` | Valida el perfil; devuelve "gente como tú" y las bifurcaciones que aplican. |
| `POST /api/gemelo/leer` | Claude arma el gemelo desde el CV y un texto libre. 503 si no hay Claude. |
| `POST /api/partidas/turno` | Recalcula la partida y devuelve la siguiente decisión, con la probabilidad de cada resultado, o el final. |
| `POST /api/historia` | Narración del año y carta a la medida. Campos en `null` si no hay Claude. |
| `POST /api/epilogo` | Cierre de la vida. `epilogo: null` si no hay Claude. |
| `POST /api/comparaciones` | Los dos caminos en los cuatro mundos, con veredicto y aprendizajes. `GET /api/comparaciones/{id}` la recupera. |
| `GET /api/calibracion` | Qué indicadores chilenos reproduce la cohorte simulada. |
| `GET /api/fuentes` | Parámetros con fuente y calidad, y los supuestos del juego. |

### Cambios frecuentes

- **Agregar una bifurcación:** un objeto en `bifurcaciones` de `juego.json` con la decisión y sus dos opciones.
- **Cambiar un mundo:** `mundos.json`. `parametros` reemplaza valores de `parametros.json`; `multiplicadores` son expresiones del mismo lenguaje.
- **Cambiar cómo deciden los gemelos:** `politica` en `juego.json`. Después corre `GET /api/calibracion`: `oferta_externa` y `cesantia` están calibradas contra la EPS.
- **Actualizar los datos:** reemplaza `backend/data/simulador/` por el paquete regenerado y corre `make test`.

## Frontend (`frontend/src`)

El juego usa el kit de UI del Claude Design "Gemelo Laboral · simulador de vida" (`shared/ui`). Columna de teléfono, una decisión por año.

| Pantalla | Archivo | Qué muestra |
|---|---|---|
| Inicio | `features/juego/Inicio.tsx` | Portada con `LifePathHero`. |
| Sobre ti | `features/juego/SobreTi.tsx` | "Mi Claude ya sabe" (texto o CV → `POST /api/gemelo/leer`) o "Lo lleno yo"; datos mínimos (incluye cargo y empresa), prioridades y mundo. |
| Temporada | `features/juego/Temporada.tsx` | Una por año: tu pega, contadores (empresas, ascensos, sueldo máx, ahorro), cómo te fue el año anterior y el **mercado**: ofertas de empresas reales con su sueldo, la carta de vida del año y "Seguir en tu pega". |
| Momento duro | `features/juego/Momento.tsx` | Despido, cierre o colapso, con la cifra real que lo pone en contexto. |
| Fin | `features/juego/Fin.tsx` | Carta de carrera (media, veredicto, atributos DIN/CAR/BIE/VID), logros, tus empresas, tu suerte entre 400 vidas tuyas (`POST /api/suerte`) y "vida del día". |

`features/juego/useVida.ts` lleva la carrera: recalcula la partida con cada elección (una por temporada) y pide a Claude, sin bloquear, el relato del año y el título del mercado. `features/juego/carrera.ts` calcula contadores, veredicto y logros.

### De dónde salen las empresas

`backend/app/sim/mercado.py` arma el mercado de cada temporada del jugador (los gemelos que juegan solos siguen con las reglas calibradas del paquete). Cuántas ofertas llegan y qué sueldo traen sale del paquete (EPS, Banco Central, ESI). Quién ofrece sale de datos reales, en `backend/data/empresas/`:

| Archivo | Fuente |
|---|---|
| `sii_empleadores.csv` | SII, nómina de empresas personas jurídicas 2024: 60 grandes y 250 pymes activas por rubro, con trabajadores y comuna. |
| `getonbrd_ofertas.csv` | Get on Board, API pública: avisos vigentes con empresa, cargo, sueldo y postulantes. |
| `concursos_estado.csv` | empleospublicos.cl: concursos 2025-2026 con renta. |
| tabla `yc_chile` del paquete | Directorio de Y Combinator: startups con operación en Chile. |

Se regeneran con `python3 -I backend/scripts/datos_empresas.py <carpeta datos_laborales>` (los crudos del SII pesan 2 GB y no van al repo).

Importa con el alias `@/` (apunta a `src/`).

### Kit de UI (`shared/ui`)

Todo se importa desde `@/shared/ui`; los estilos (`shared/ui/styles/vida.css`, clases `vd-*`) se cargan una vez en `main.tsx`. La paleta vive en las variables de `:root` de ese archivo.

- Layout: `Screen` (tono `dia`/`noche`, `scene`), `ScreenHeader`, `ScreenFooter`, `Stack`, `Row`, `Panel`, `SunCard`, `NightBand`, `SlowReveal`
- Texto: `Heading`, `Text`, `Meta`, `Pill`, `BigNumber`, `Narrative`
- Acciones y controles: `Button`, `IconButton`, `Chip`, `ChipGroup`, `Segmented`, `Slider`, `Tag`; campos de texto con `.vd-campos` / `.vd-campo`
- Juego: `IndicatorGrid`/`Indicator` (dinero, carrera, bienestar, vida), `DecisionCard`/`DecisionList` + `DecisionArt` (viaje, consultora, invertir, magister, cohete, puerta, casa, gente, noche, quedarse)
- Personas: `Notification`, `Avatar`, `PeopleTally`, `DotRow`, `DotLegend`, `MissedList`
- Gráficos: `LinesChart`, `RangeCompare` (rangos Monte Carlo A vs B), `VisitsTimeline`, `StationTimeline`, `YearTicker`
- Escenas: `LifePathHero`, `TravelScene`, `OfficeScene`

Las escenas animadas usan un reloj CSS (`--vd-t`): pon `scene="once"` en el `Screen` y usa `revealAt` en indicadores y notificaciones para que entren en su momento (ver `shared/ui/scene.ts`). Catálogo vivo y las 8 pantallas de referencia en **http://localhost:5173/ui** (`features/ui-kit`).

## Plantilla

`template/` es la plantilla cookiecutter con la que partió el proyecto. Ya no refleja el código: no regeneres encima.
