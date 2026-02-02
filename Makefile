POETRY_VERSION=2.2.1
APP_NAME=dns-console

python-env:
	# Create virtual environment if it doesn't exist
	if [ ! -d .venv ]; then python3.12 -m venv .venv; fi
	. .venv/bin/activate; \
	pip install -U pip; \
	pip install poetry==$(POETRY_VERSION); \
	poetry config virtualenvs.in-project true; \
	poetry install --no-root
	@echo "Environment setup complete."
	@echo "Activate with '. .venv/bin/activate', or use 'make shell' to enter a Docker container."

node-env:
	npm --prefix=frontend install

env:node-env python-env
	# Copy .env.example to .env if it doesn't exist
	if [ ! -f .env ]; then cp .env.example .env; fi

clean:
	rm -rf frontend/dist
	rm -rf frontend/node_modules
	rm -rf .venv

ui-build:
	npm --prefix=frontend run build

build: ui-build
	docker build -t $(APP_NAME) .

runserver: build
	docker compose up -d $(APP_NAME)
	npm --prefix=frontend run dev

pretty:
	black ./backend
	npm --prefix=frontend run prettier:write

lint:
	flake8 .
	npm --prefix=frontend run eslint