.PHONY: install back front test perfil simular jugar comparar dudas validar supuestos
install:
	cd backend && uv sync
	cd frontend && npm install
back:
	cd backend && uv run uvicorn app.main:app --reload --port 8000
front:
	cd frontend && npm run dev
test:
	cd backend && uv run pytest -q
# Trayectoria laboral desde el terminal. Ej: make perfil OCUPACION=4 EDAD=24
OCUPACION ?= 2
EDAD ?= 30
SUELDO ?= 900000
DECISIONES ?= seguir,seguir,cambiar_pega,seguir,seguir
perfil:
	cd backend && uv run python -m app.cli perfil --ocupacion $(OCUPACION) --edad $(EDAD)
simular:
	cd backend && uv run python -m app.cli simular --ocupacion $(OCUPACION) --edad $(EDAD) --sueldo $(SUELDO) --decisiones $(DECISIONES) $(if $(SEED),--seed $(SEED))
# El juego desde el terminal (motor del paquete). Ej: make jugar DUDA=unirse_a_startup SEMILLA=7
#   make jugar DUDA=emprender AUTO=1        partida completa sin teclado
#   make jugar DUDA=renunciar ELECCIONES=1,2,1 AUTO=1
#   make comparar DUDA=cambiar_de_rubro RUBRO=Salud NIVEL=2 SUELDO_JUEGO=2000000
SEXO ?= m
EDU ?= universitaria
RUBRO ?= Servicios profesionales
TIPO_EMPLEADOR ?= pyme
NIVEL ?= 1
SUELDO_JUEGO ?= 1400000
RIESGO ?= 5
GEMELOS ?= 500
DUDA ?= unirse_a_startup
N ?= 5000
PERFIL_JUEGO = --edad $(EDAD) --sexo $(SEXO) --edu $(EDU) --rubro "$(RUBRO)" --tipo-empleador $(TIPO_EMPLEADOR) --nivel $(NIVEL) --sueldo $(SUELDO_JUEGO) --riesgo $(RIESGO)
jugar:
	cd backend && uv run python -m app.cli jugar $(PERFIL_JUEGO) --gemelos $(GEMELOS) $(if $(filter-out file,$(origin DUDA)),--duda $(DUDA)) $(if $(SEMILLA),--semilla $(SEMILLA)) $(if $(ELECCIONES),--elecciones $(ELECCIONES)) $(if $(AUTO),--auto)
comparar:
	cd backend && uv run python -m app.cli comparar $(PERFIL_JUEGO) --gemelos $(GEMELOS) --duda $(DUDA) $(if $(SEMILLA),--semilla $(SEMILLA)) $(if $(JSON),--json)
dudas:
	cd backend && uv run python -m app.cli dudas $(PERFIL_JUEGO)
validar:
	cd backend && uv run python -m app.cli validar --n $(N) $(if $(SEMILLA),--semilla $(SEMILLA))
# De dónde sale cada número: make supuestos  (o make supuestos CALIDAD=supuesto)
supuestos:
	cd backend && uv run python -m app.cli supuestos $(if $(CALIDAD),--calidad $(CALIDAD))
