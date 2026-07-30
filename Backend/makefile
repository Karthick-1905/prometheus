# CAT Smart Rental — local pipeline helpers
# Run from Backend/:  make help

.PHONY: help up down restart logs ps redis-cli \
	run-subscriber run-publisher run-api \
	install install-redis

PYTHON   ?= .venv/bin/python
PIP      ?= .venv/bin/pip
COMPOSE  ?= docker compose -f docker-compose.yaml

# Defaults for local redis (override via env)
export REDIS_URL ?= redis://localhost:6380/0
export REDIS_TELEMETRY_CHANNEL ?= telemetry:events
export MQTT_BROKER_URL ?= mqtt://broker.hivemq.com:1883

help:
	@echo "CAT Smart Rental — IoT pipeline"
	@echo ""
	@echo "Infrastructure (Redis pub/sub bus)"
	@echo "  make up            Start Redis container"
	@echo "  make down          Stop Redis container"
	@echo "  make restart       Restart Redis"
	@echo "  make logs          Tail Redis logs"
	@echo "  make ps            Show compose status"
	@echo "  make redis-cli     Open redis-cli in the container"
	@echo ""
	@echo "Pipeline workers"
	@echo "  make run-publisher   Simulate IoT devices → MQTT broker"
	@echo "  make run-subscriber  MQTT → IngestionService (persist + publish)"
	@echo "  make run-api         FastAPI on :8000"
	@echo ""
	@echo "Setup"
	@echo "  make install         pip install -r requirements.txt"
	@echo ""
	@echo "Env defaults:"
	@echo "  REDIS_URL=$(REDIS_URL)"
	@echo "  REDIS_TELEMETRY_CHANNEL=$(REDIS_TELEMETRY_CHANNEL)"
	@echo "  MQTT_BROKER_URL=$(MQTT_BROKER_URL)"

# ── Docker / Redis ──────────────────────────────────────────────

up:
	$(COMPOSE) up -d
	@echo "Waiting for Redis health..."
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
		if $(COMPOSE) exec -T redis redis-cli ping 2>/dev/null | grep -q PONG; then \
			echo "✓ Redis ready at $(REDIS_URL)"; \
			exit 0; \
		fi; \
		sleep 1; \
	done; \
	echo "⚠ Redis did not become ready in time — check: make logs"; \
	exit 1

down:
	$(COMPOSE) down

restart:
	$(COMPOSE) restart

logs:
	$(COMPOSE) logs -f redis

ps:
	$(COMPOSE) ps

redis-cli:
	$(COMPOSE) exec redis redis-cli

# ── App workers ─────────────────────────────────────────────────

run-subscriber:
	$(PYTHON) pipeline/mqtt_subscriber.py

run-publisher:
	$(PYTHON) pipeline/publish_telemetry.py

run-api:
	$(PYTHON) -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# ── Setup ───────────────────────────────────────────────────────

install:
	$(PIP) install -r requirements.txt

install-redis:
	$(PIP) install "redis>=5.0.0,<6"
