# BiforkStrange

<img src="./project-logo.png" alt="BiforkStrange" width="200" />

Track: Simulations · Platanus Hack 26 Santiago, team 32

Tu gemelo digital vive tus decisiones de carrera antes que tú. Creas tu gemelo, eliges una decisión con dos caminos (cambiarte o quedarte, irte a una startup, emprender, un magíster), juegas 10 años de cada uno y el motor corre cientos de vidas de ambos, con la misma suerte, en cuatro mundos distintos. No te da un número: te muestra qué camino es robusto y cuál es una apuesta.

Los números salen de datos chilenos (ESI 2025, EPS 2024, ELSOC, mifuturo) y cada uno muestra su fuente en el juego. Claude lee el CV y narra; nunca calcula.

## Stack

- `backend/`: FastAPI + motor de microsimulación que interpreta las reglas de `backend/data/`
- `frontend/`: Vite + React + TypeScript
- `supabase/`: esquema y migraciones

## Correr local

```bash
make install
make back    # http://localhost:8000/docs
make front   # http://localhost:5173
```

Detalles de arquitectura en [DEV.md](DEV.md).

## Equipo

- José Tomás Valdivia ([@jtvaldivia](https://github.com/jtvaldivia))
- Vicente Cruz ([@vicente-cruz-labra](https://github.com/vicente-cruz-labra))
- Cristóbal Pérez-cotapos ([@cristobalperez-cotapos](https://github.com/cristobalperez-cotapos))
- Benito Palacios Medeiros ([@benitopalaciosm](https://github.com/benitopalaciosm))
- Alonso Peralta Sarrat ([@aperaltas16](https://github.com/aperaltas16))
