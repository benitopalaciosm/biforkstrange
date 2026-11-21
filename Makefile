.PHONY: install back front test
install:
	cd backend && uv sync
	cd frontend && npm install
back:
	cd backend && uv run uvicorn app.main:app --reload --port 8000
front:
	cd frontend && npm run dev
test:
	cd backend && uv run pytest -q
