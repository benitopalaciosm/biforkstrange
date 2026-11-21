# AGENTS.md

Reglas para cualquier agente (Claude Code, Codex, Cursor, etc.) o persona que trabaje en este repo.

## Git

- Nunca hagas push directo a `main`. Todo cambio va en una rama y entra por PR.
- Nombra la rama según el tipo de cambio: `feat/...`, `fix/...`, `docs/...`, `chore/...`.
- No mergees tu propio PR: lo revisa y mergea alguien del equipo.
- Nada de `push --force` a ramas compartidas ni reescribir historia de `main`.
- No commitees secretos (`.env`, llaves, tokens) ni archivos de más de 100 MB.

## Repos

- El trabajo se hace en `jtvaldivia/biforkstrange`. Los PR van ahí.
- El repo de Platanus (`platanus-hack/platanus-hack-26-cl-team-32`) trae `main` de este repo cada 30 minutos con el workflow `sync-upstream.yml`. No commitees directo en el de Platanus, porque genera conflictos en esa sincronización.

## Antes de abrir el PR

- `make test` pasa.
- `cd frontend && npm run build` compila.
- Si cambiaste la estructura base, el cambio va también en `template/` (cookiecutter). Ver `DEV.md`.
