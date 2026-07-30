"""Redis pub/sub + short recent buffer for live telemetry logs.

Channel (default): telemetry:events
Recent list key:   {channel}:recent  (LPUSH, capped)
"""
from __future__ import annotations

import json
import threading
import time
import uuid
from datetime import datetime
from typing import Any, Callable, Iterator, Optional

from app.config import get_settings

_client = None
_client_lock = threading.Lock()


def get_redis():
    """Lazy Redis client. Returns None if redis package/server unavailable."""
    global _client
    if _client is not None:
        return _client
    with _client_lock:
        if _client is not None:
            return _client
        try:
            import redis  # type: ignore

            settings = get_settings()
            client = redis.Redis.from_url(
                settings.redis_url,
                decode_responses=True,
                socket_connect_timeout=1.5,
                socket_timeout=2.0,
            )
            client.ping()
            _client = client
            return _client
        except Exception:  # noqa: BLE001
            return None


def channel_name() -> str:
    return get_settings().redis_telemetry_channel


def recent_key() -> str:
    return f"{channel_name()}:recent"


def publish_live_event(event: dict[str, Any]) -> bool:
    """
    Publish a live log event to Redis pub/sub and prepend to recent buffer.
    Never raises — ingestion must not fail if Redis is down.
    """
    payload = {
        "id": event.get("id") or f"evt-{uuid.uuid4().hex[:12]}",
        "type": event.get("type") or "TELEMETRY_RECEIVED",
        "ts": event.get("ts") or datetime.utcnow().isoformat(),
        **{k: v for k, v in event.items() if k not in {"id", "type", "ts"}},
    }
    raw = json.dumps(payload, default=str)
    client = get_redis()
    if client is None:
        return False
    try:
        pipe = client.pipeline()
        pipe.publish(channel_name(), raw)
        pipe.lpush(recent_key(), raw)
        pipe.ltrim(recent_key(), 0, 199)  # keep last 200
        pipe.execute()
        return True
    except Exception:  # noqa: BLE001
        return False


def recent_events(limit: int = 50) -> list[dict[str, Any]]:
    client = get_redis()
    if client is None:
        return []
    try:
        rows = client.lrange(recent_key(), 0, max(0, limit - 1))
        out: list[dict[str, Any]] = []
        for raw in rows:
            try:
                out.append(json.loads(raw))
            except json.JSONDecodeError:
                continue
        return out
    except Exception:  # noqa: BLE001
        return []


def subscribe_events(
    stop_event: threading.Event,
    *,
    on_message: Optional[Callable[[dict[str, Any]], None]] = None,
) -> Iterator[dict[str, Any]]:
    """
    Blocking generator of live events until stop_event is set.
    Yields parsed dicts. Safe if Redis is unavailable (exits immediately).
    """
    client = get_redis()
    if client is None:
        return
    pubsub = client.pubsub(ignore_subscribe_messages=True)
    try:
        pubsub.subscribe(channel_name())
        while not stop_event.is_set():
            msg = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
            if not msg:
                continue
            if msg.get("type") != "message":
                continue
            data = msg.get("data")
            if not data:
                continue
            try:
                event = json.loads(data)
            except json.JSONDecodeError:
                continue
            if on_message:
                on_message(event)
            yield event
    finally:
        try:
            pubsub.unsubscribe(channel_name())
            pubsub.close()
        except Exception:  # noqa: BLE001
            pass


def redis_status() -> dict[str, Any]:
    client = get_redis()
    if client is None:
        return {"ok": False, "url": get_settings().redis_url, "channel": channel_name()}
    try:
        pong = client.ping()
        n = client.llen(recent_key())
        return {
            "ok": bool(pong),
            "url": get_settings().redis_url,
            "channel": channel_name(),
            "recentCount": int(n),
        }
    except Exception as exc:  # noqa: BLE001
        return {
            "ok": False,
            "url": get_settings().redis_url,
            "channel": channel_name(),
            "error": str(exc),
        }
