# Validación del paso laboral contra Chile (T7)

Reproducir: desde `backend/`, `python -m app.sim.validation` (2 segundos). Tests: `pytest tests/test_validation.py`.

## Resumen

1. **La entrada a cesantía y la desocupación de 25 a 49 años cuadran. El resto no.**
2. El motor devuelve al empleo demasiado rápido: 60-70% al año, contra 27-61% en ELSOC. Y saca del empleo a muy pocos desde los 30 (4-5% al año contra 8%), porque la EPS casi no registra salidas a inactividad.
3. La desocupación cuadra **por errores que se compensan**: entra el doble de gente a cesantía de la que debería estar al cierre del año, y sale demasiado rápido.
4. La hipótesis del paso anual es correcta, pero **corregir solo la entrada (variante A) empeora el resultado**. Hay que corregir entrada y salida juntas (variante B).
5. Con B el error medio contra ELSOC baja de 10,2 a 4,0 puntos. Lo que queda sin cuadrar es la inactividad desde los 30, y eso no lo arregla ningún cambio del paso: es un problema del dato de entrada.

## Qué se comparó

| Referencia | Qué mide | ¿Independiente del motor? |
|---|---|---|
| ELSOC 2016-2022, matriz anual O / D / I | Estado al inicio del año vs estado un año después | Sí |
| ESI 2025, `desocupacion_*` | Desocupados / (ocupados + desocupados), por tramo de 5 años | Sí |
| EPS, `cambio_*` y `sigue_cesante_12m` | Cambio de empleador al año; sigue cesante a 12 meses | **No**: son las mismas columnas que el motor lee. Solo confirman que el motor reproduce su insumo |

Medición del motor: `labor.advance` sin modificar, 40.000 gemelos. Dos arneses: régimen a edad fija (24, 37 y 52 años, 40 años de quema, grupo ocupacional fijo) para las filas ELSOC, y una cohorte de 18 a 49 años para las metas del paquete. Todo se midió para el grupo 2 y para el promedio de grupos con los pesos ocupacionales de la ESI; las tablas de abajo son el promedio (el grupo 2 difiere en menos de 1 punto).

Qué comparación es justa:

- **Justa:** empleado → sin empleo del motor contra O → D+I de ELSOC. Ambos juntan cesantía e inactividad y ambos son de punta a punta del año.
- **Justa con una etiqueta:** el motor no distingue cesante de inactivo. El arnés etiqueta a cada persona que pierde el empleo como inactiva con probabilidad p_inactividad / (p_cesantia + p_inactividad) de su tramo. Es exacto en esperanza porque el motor trata igual a ambas. Con esa etiqueta se compara contra O → D, O → I y la desocupación de la ESI.
- **Injusta:** el flag `desempleado` directo contra la desocupación ESI (el flag incluye inactivos). Se muestra en la salida del script como "no valida".
- **Injusta:** el stock ELSOC de no ocupados contra el flag. ELSOC incluye gente que nunca trabajó; el gemelo siempre parte con empleo. En su lugar se usa lo que la matriz ELSOC implica para alguien que sale de un empleo (ver `referencia_elsoc`). Esa derivación supone que la matriz es de Markov y su fila I mezcla inactivos permanentes, así que **subestima el retorno**: es un piso. El techo es D → O (solo cesantes, n de 135 a 187).

## Resultados

Valores en %; entre paréntesis el error en puntos; **negrita** = fuera de tolerancia (3 puntos; 8 para el retorno al empleo, por el tamaño de muestra de las filas D e I).

| Métrica | Tramo | Ref. | Actual | Variante A | Variante B |
|---|---|---|---|---|---|
| Empleado → sin empleo (ELSOC O→D+I) | 18-29 | 12,8 | 15,7 (+2,8) | 11,2 (−1,6) | 11,2 (−1,6) |
| | 30-44 | 8,0 | **4,9 (−3,1)** | **3,4 (−4,6)** | **3,4 (−4,6)** |
| | 45-59 | 8,2 | **4,1 (−4,1)** | **2,9 (−5,3)** | **2,9 (−5,3)** |
| Empleado → cesante (ELSOC O→D) | 18-29 | 4,2 | **9,2 (+4,9)** | 4,8 (+0,5) | 4,8 (+0,5) |
| | 30-44 | 3,3 | 3,9 (+0,5) | 2,4 (−0,9) | 2,4 (−0,9) |
| | 45-59 | 3,0 | 3,2 (+0,2) | 2,0 (−1,0) | 2,0 (−1,0) |
| Empleado → inactivo (ELSOC O→I) | 18-29 | 8,6 | 6,5 (−2,1) | 6,4 (−2,1) | 6,4 (−2,2) |
| | 30-44 | 4,7 | **1,0 (−3,7)** | **1,0 (−3,7)** | **1,0 (−3,7)** |
| | 45-59 | 5,2 | **0,9 (−4,3)** | **0,9 (−4,3)** | **0,9 (−4,3)** |
| Sin empleo → empleado (ELSOC, ex ocupados; piso) | 18-29 | 42,1 | **70,1 (+28,0)** | **70,5 (+28,4)** | 45,4 (+3,3) |
| | 30-44 | 36,3 | **68,3 (+32,1)** | **68,2 (+31,9)** | 39,5 (+3,2) |
| | 45-59 | 26,6 | **60,1 (+33,5)** | **59,7 (+33,1)** | 23,2 (−3,4) |
| Proporción sin empleo en régimen (ELSOC, ex ocupados) | 18-29 | 23,3 | **18,2 (−5,1)** | **13,7 (−9,6)** | **19,7 (−3,6)** |
| | 30-44 | 18,1 | **6,7 (−11,4)** | **4,7 (−13,4)** | **7,8 (−10,3)** |
| | 45-59 | 23,6 | **6,5 (−17,1)** | **4,6 (−18,9)** | **11,0 (−12,6)** |
| Desocupación ESI (cohorte, solo cesantes) | 18-24 | 21,9 | **11,3 (−10,6)** | **6,1 (−15,8)** | **8,1 (−13,8)** |
| | 25-29 | 11,8 | 11,4 (−0,4) | **6,1 (−5,6)** | 9,2 (−2,5) |
| | 30-34 | 7,5 | 5,6 (−1,9) | **3,4 (−4,1)** | 6,3 (−1,2) |
| | 35-39 | 6,8 | 5,3 (−1,5) | **3,2 (−3,6)** | 5,5 (−1,3) |
| | 40-44 | 5,8 | 5,2 (−0,6) | 3,1 (−2,7) | 5,2 (−0,6) |
| | 45-49 | 6,0 | 5,0 (−1,0) | 3,0 (−3,0) | 6,1 (+0,1) |
| **Error absoluto medio, las 21 filas** | | | 8,0 | 9,3 | 3,8 |
| Solo ELSOC (15 filas) | | | 10,2 | 10,6 | 4,0 |
| Solo ESI (6 filas) | | | 2,7 | 5,8 | 3,3 |

Retorno al empleo contra el rango ELSOC [piso ex ocupados, techo D→O]:

| Tramo | Rango ELSOC | Actual | B |
|---|---|---|---|
| 18-29 | 42,1 a 60,7 | 70,1 | 45,4 |
| 30-44 | 36,3 a 49,4 | 68,3 | 39,5 |
| 45-59 | 26,6 a 56,4 | 60,1 | 23,2 |

El motor actual queda sobre el techo en los tres tramos. En 45-59 por solo 3,7 puntos, dentro del ruido de la fila D: ahí la evidencia de que es demasiado rápido descansa en la fila I.

Filas que no validan (meta = insumo): cambio directo de empleador 21,7 / 13,5 / 10,0 contra 21,8 / 13,8 / 10,2; sigue cesante al cierre del año siguiente 31,5 contra 34,0.

## Qué cuadra

- Empleado → cesante en 30-44 y 45-59, y empleado → inactivo en 18-29.
- Desocupación ESI de 25 a 49 años (los cinco tramos, error máximo 1,9 puntos).
- El motor reproduce su insumo EPS (cambio de empleador, sigue cesante). El factor de rotación por grupo no sesga el promedio: pesa 1,013 con la mezcla ocupacional chilena.

## Qué no cuadra y por qué

**1. El paso anual, primera mitad: quien cae en cesantía queda sin empleo todo el año.** Hipótesis confirmada. La tasa EPS es de eventos en el año; ELSOC mide dónde está la persona al cierre. Con la sobrevida de la misma tabla EPS, quien cae en un mes al azar sigue cesante al cierre con probabilidad m1 = (1 + 2·sigue_3m + 3·sigue_6m + 2·sigue_12m) / 8 = 0,516 / 0,595 / 0,596. Sin simular nada:

| Tramo | EPS cae en cesantía | × m1 | ELSOC O→D |
|---|---|---|---|
| 18-29 | 9,13 | 4,71 | 4,25 |
| 30-44 | 3,85 | 2,29 | 3,31 |
| 45-59 | 3,19 | 1,90 | 2,97 |

En 18-29 el motor pone 9,2% de los empleados en cesantía al cierre; ELSOC mide 4,2%.

**2. El paso anual, segunda mitad: quien parte el año sin empleo vuelve con 1 − sigue_12m.** También confirmada, y es la brecha más grande. 1 − sigue_12m es la probabilidad de volver en los primeros 12 meses de un episodio nuevo. Quien parte el año sin empleo ya lleva tiempo, y la salida se frena: entre los meses 12 y 24 solo vuelve 1 − sigue_24m / sigue_12m = 39% / 30% / 19%, no 70% / 68% / 60%.

**3. Por qué la desocupación cuadra igual.** Los errores 1 y 2 se cancelan en el stock: entra el doble y sale el doble de rápido. Por eso arreglar solo el 1 (variante A) hunde la desocupación a la mitad (6,1% contra 11,8% en 25-29). El calce actual con la ESI no es evidencia de que el paso esté bien.

**4. La salida a inactividad desde los 30 es cinco veces menor que en ELSOC.** La EPS da 1,0% y 0,9% al año; ELSOC 4,7% y 5,2%. No es un problema del paso sino del dato: probablemente la historia laboral autorreportada de la EPS no registra salidas cortas a inactividad. No hay nada en las tablas del motor para corregirlo. Es lo que más pesa en la proporción sin empleo en régimen desde los 30 (6,7% contra 18,1%).

**5. Desocupación 18-24 (11,3% contra 21,9%).** El gemelo parte empleado a los 18. En la ESI, 36% de los desocupados de ese tramo busca su primer trabajo. Aun descontándolos queda una brecha de unos 4 puntos.

**6. Hallazgo fuera de las tablas: el desgaste.** Con la decisión "seguir" el desgaste sube 0,02 al año, pasa el umbral de 0,6 cerca de los 38 y empieza a sumar riesgo de salida. En el motor completo (`engine.simulate`, cohorte de 18 a 49) la proporción sin empleo a los 45-49 es 13,3%; con el mismo paso sin desgaste, 6,3%. En simulaciones largas este supuesto sin calibrar pesa más que todas las tablas.

**7. Posible, sin poder confirmarlo con las tablas:** "sigue cesante" en la EPS termina cuando termina el episodio de cesantía, que puede ser hacia inactividad y no solo hacia empleo. Si es así, 1 − sigue_12m sobreestima el retorno al empleo aunque se arreglen 1 y 2.

## Variantes medidas

Ambas usan solo `eps_cesantia_duracion.csv`. Sin parámetros libres.

- **A.** Quien cae en cesantía queda sin empleo al cierre con probabilidad m1; el resto volvió a trabajar dentro del año (empleo nuevo). La salida de quien parte el año sin empleo no cambia.
- **B.** A, más salida según cuánto lleva sin empleo: f1 = 1 − m2/m1 si cayó el año anterior, f2 = 1 − sigue_24m/sigue_12m si lleva más de un año, con m2 = (sigue_12m + sigue_24m) / 2.

| | 18-29 | 30-44 | 45-59 |
|---|---|---|---|
| m1 | 0,516 | 0,595 | 0,596 |
| f1 | 0,534 | 0,543 | 0,388 |
| f2 | 0,386 | 0,300 | 0,187 |
| hoy: 1 − sigue_12m | 0,702 | 0,680 | 0,598 |

## Recomendación

**Implementar B. No implementar A sola.**

En `labor.advance`, con un contador nuevo `anios_sin_empleo` (cierres de año seguidos sin empleo; 0 con empleo):

```
p_ces  = p_cesantia[b] · riesgo_rel · mult + riesgo_desgaste
p_ina  = p_inactividad[b] · mult
cae_cesantia    = empleado y u < p_ces
cae_inactividad = empleado y p_ces ≤ u < p_ces + p_ina
directo         = empleado y p_ces + p_ina ≤ u < p_ces + p_ina + p_directo

retorno   = cae_cesantia y u2 < 1 − m1[b]          # volvió dentro del año: empleo nuevo, no queda sin empleo
perdio    = (cae_cesantia y no retorno) o cae_inactividad
reempleo  = desempleado y u3 < (f1[b] si anios_sin_empleo ≤ 1, si no f2[b])
nuevo     = directo o reempleo o retorno
```

Al implementarla hay que decidir si `retorno` cuenta como `perdio_empleo` para la caída de sueldo de las decisiones (hoy 0,6): la persona sí perdió el empleo, pero termina el año trabajando. Dos tests de `test_labor.py` cambian de valor esperado (`test_un_anio_reproduce_la_eps`, `test_reempleo_y_antiguedad`).

Qué queda sin cuadrar con B:

- Empleado → sin empleo desde los 30: 3,4% y 2,9% contra 8,0% y 8,2%. B lo deja peor que hoy en esa fila, porque quita la sobreestimación de cesantía que tapaba la falta de inactividad. Es el costo de dejar de compensar errores.
- Proporción sin empleo en régimen desde los 30: 7,8% y 11,0% contra 18,1% y 23,6% (la referencia es un techo, ver arriba).
- Desocupación 18-24.
- En 45-59 el retorno de B (23,2%) queda 3,4 puntos bajo el piso ELSOC. f2 de ese tramo sale de la cola de la sobrevida, con 32% de episodios censurados.
- La meta `sigue_cesante_12m` medida sobre años simulados da 26% con B, no 34%. No es un error de B: en una grilla anual "el cierre del año siguiente" cae entre 12 y 24 meses después de la caída, y la EPS da ahí (sigue_12m + sigue_24m) / 2. Esa meta hay que medirla distinto o sacarla.

Decisiones que no son del paso y que conviene tomar aparte:

- Inactividad desde los 30: o se acepta que el simulador modela solo cesantía (y se dice así en la pantalla), o se busca otra fuente para la tasa de salida a inactividad. Usar ELSOC como insumo la quemaría como referencia.
- Desgaste: calibrarlo o acotarlo antes de mostrar simulaciones de más de 15 años.
