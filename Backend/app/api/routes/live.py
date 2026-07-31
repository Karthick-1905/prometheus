"""SSE live streams for Fleet Manager / Site Manager dashboards.

Live logs prefer Redis pub/sub (ingestion publishes telemetry:events).
Falls back to DB polling when Redis is unavailable.
"""
from __future__ import annotations

import asyncio
import json
import queue
import threading
from datetime import datetime
from typing import Any, AsyncIterator, Callable, Optional, Tuple

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.security.dashboard_access import (
    DashboardPrincipal,
    get_dashboard_principal,
    require_fleet_access,
    require_site_ops,
)
from app.services.fleet import FleetService
from app.services.redis_bus import recent_events, redis_status, subscribe_events

router = APIRouter(prefix="/api/v1/live", tags=["Live SSE"])

# Tests can replace this with a lambda that returns the SQLite session.
# Returns (session, should_close).
LiveSessionFactory = Callable[[], Tuple[Session, bool]]


def default_live_session() -> Tuple[Session, bool]:
    return SessionLocal(), True


get_live_session: LiveSessionFactory = default_live_session


def _sse(event: str, data: dict, event_id: Optional[str] = None) -> str:
    payload = json.dumps(data, default=str)
    parts = []
    if event_id:
        parts.append(f"id: {event_id}")
    parts.append(f"event: {event}")
    parts.append(f"data: {payload}")
    parts.append("")
    return "\n".join(parts) + "\n"


async def _poll_stream(
    request: Request,
    *,
    interval_sec: float,
    max_ticks: int,
    producer,
) -> AsyncIterator[str]:
    tick = 0
    while tick < max_ticks:
        if await request.is_disconnected():
            break
        tick += 1

        def _run():
            db, should_close = get_live_session()
            try:
                return producer(db, tick)
            finally:
                if should_close:
                    db.close()

        try:
            events = await asyncio.to_thread(_run)
        except Exception as exc:  # noqa: BLE001
            yield _sse(
                "error",
                {"message": str(exc), "ts": datetime.utcnow().isoformat()},
                event_id=str(tick),
            )
            await asyncio.sleep(interval_sec)
            continue

        for event_name, payload in events:
            yield _sse(event_name, payload, event_id=str(tick))

        yield _sse(
            "heartbeat",
            {"tick": tick, "ts": datetime.utcnow().isoformat()},
            event_id=str(tick),
        )
        await asyncio.sleep(interval_sec)


async def _redis_log_stream(
    request: Request,
    *,
    company_id: Optional[int],
    equipment_id: Optional[str],
    max_seconds: float,
    recent_limit: int,
) -> AsyncIterator[str]:
    """
    Stream Redis live logs:
      1) recent buffer snapshot
      2) pub/sub messages until max_seconds or disconnect
    """
    status = redis_status()
    yield _sse(
        "stream.ready",
        {
            "source": "redis" if status.get("ok") else "unavailable",
            "redis": status,
            "companyId": company_id,
            "equipmentId": equipment_id,
            "ts": datetime.utcnow().isoformat(),
        },
        event_id="0",
    )

    if not status.get("ok"):
        yield _sse(
            "error",
            {
                "message": (
                    "Redis unavailable — start with `make up` "
                    f"(expected {status.get('url')}). Falling back is not used on this channel."
                ),
                "ts": datetime.utcnow().isoformat(),
            },
            event_id="err",
        )
        return

    # Recent history first (newest-first already)
    recent = recent_events(limit=recent_limit)
    # reverse so UI sees chronological if it prepends; we still send as history.batch
    history = list(reversed(recent))
    if equipment_id:
        history = [
            e
            for e in history
            if str(e.get("equipmentId") or "") == str(equipment_id)
        ]
    yield _sse(
        "log.history",
        {
            "logs": history,
            "count": len(history),
            "ts": datetime.utcnow().isoformat(),
        },
        event_id="history",
    )

    stop = threading.Event()
    q: queue.Queue = queue.Queue(maxsize=500)

    def _reader():
        try:
            for event in subscribe_events(stop):
                try:
                    q.put(event, timeout=0.2)
                except queue.Full:
                    pass
        except Exception as exc:  # noqa: BLE001
            try:
                q.put({"__error__": str(exc)}, timeout=0.2)
            except queue.Full:
                pass

    thread = threading.Thread(target=_reader, name="redis-live-logs", daemon=True)
    thread.start()

    started = asyncio.get_event_loop().time()
    tick = 0
    try:
        while True:
            if await request.is_disconnected():
                break
            if max_seconds > 0 and (asyncio.get_event_loop().time() - started) >= max_seconds:
                break
            tick += 1

            drained = 0
            while drained < 50:
                try:
                    item = q.get_nowait()
                except queue.Empty:
                    break
                drained += 1
                if "__error__" in item:
                    yield _sse(
                        "error",
                        {"message": item["__error__"], "ts": datetime.utcnow().isoformat()},
                        event_id=str(tick),
                    )
                    continue
                if equipment_id and str(item.get("equipmentId") or "") != str(equipment_id):
                    continue
                yield _sse("log.append", item, event_id=str(item.get("id") or tick))

            # heartbeat so proxies / clients know stream is alive
            if tick % 4 == 0:
                yield _sse(
                    "heartbeat",
                    {
                        "tick": tick,
                        "source": "redis",
                        "ts": datetime.utcnow().isoformat(),
                    },
                    event_id=f"hb-{tick}",
                )
            await asyncio.sleep(0.25)
    finally:
        stop.set()
        thread.join(timeout=1.5)


def _latest_geofence_coordinates(
    events: list[dict[str, Any]],
    *,
    company_id: Optional[int],
) -> list[dict[str, Any]]:
    latest: dict[str, dict[str, Any]] = {}
    for event in events:
        if event.get("type") != "GEOFENCE_BATCH":
            continue
        if (
            company_id is not None
            and event.get("companyId") is not None
            and int(event["companyId"]) != company_id
        ):
            continue
        for coordinate in event.get("coordinates") or []:
            equipment_id = str(coordinate.get("equipmentId") or "")
            if equipment_id and equipment_id not in latest:
                latest[equipment_id] = coordinate
    return list(latest.values())


async def _redis_geofence_stream(
    request: Request,
    *,
    company_id: Optional[int],
    max_seconds: float,
    recent_limit: int,
) -> AsyncIterator[str]:
    """Stream batched coordinate evaluations produced by ingestion."""
    status = redis_status()
    yield _sse(
        "geofence.ready",
        {
            "source": "redis" if status.get("ok") else "unavailable",
            "companyId": company_id,
            "radiusUnit": "meters",
            "ts": datetime.utcnow().isoformat(),
        },
        event_id="geo-ready",
    )
    if not status.get("ok"):
        yield _sse(
            "error",
            {
                "message": "Redis is unavailable; live geofence batches cannot be delivered.",
                "ts": datetime.utcnow().isoformat(),
            },
            event_id="geo-error",
        )
        return

    recent = recent_events(limit=recent_limit)
    coordinates = _latest_geofence_coordinates(recent, company_id=company_id)
    yield _sse(
        "geofence.snapshot",
        {
            "coordinates": coordinates,
            "count": len(coordinates),
            "ts": datetime.utcnow().isoformat(),
        },
        event_id="geo-snapshot",
    )

    stop = threading.Event()
    event_queue: queue.Queue = queue.Queue(maxsize=200)

    def _reader():
        try:
            for event in subscribe_events(stop):
                if event.get("type") != "GEOFENCE_BATCH":
                    continue
                if (
                    company_id is not None
                    and event.get("companyId") is not None
                    and int(event["companyId"]) != company_id
                ):
                    continue
                try:
                    event_queue.put(event, timeout=0.2)
                except queue.Full:
                    pass
        except Exception as exc:  # noqa: BLE001
            try:
                event_queue.put({"__error__": str(exc)}, timeout=0.2)
            except queue.Full:
                pass

    thread = threading.Thread(
        target=_reader,
        name="redis-live-geofences",
        daemon=True,
    )
    thread.start()
    started = asyncio.get_event_loop().time()
    tick = 0
    try:
        while True:
            if await request.is_disconnected():
                break
            if max_seconds > 0 and (asyncio.get_event_loop().time() - started) >= max_seconds:
                break
            tick += 1
            try:
                item = event_queue.get_nowait()
            except queue.Empty:
                item = None
            if item:
                if "__error__" in item:
                    yield _sse(
                        "error",
                        {"message": item["__error__"], "ts": datetime.utcnow().isoformat()},
                        event_id=f"geo-error-{tick}",
                    )
                else:
                    yield _sse(
                        "geofence.batch",
                        item,
                        event_id=str(item.get("id") or item.get("batchId") or tick),
                    )
            if tick % 4 == 0:
                yield _sse(
                    "heartbeat",
                    {
                        "tick": tick,
                        "source": "redis-geofence",
                        "ts": datetime.utcnow().isoformat(),
                    },
                    event_id=f"geo-hb-{tick}",
                )
            await asyncio.sleep(0.25)
    finally:
        stop.set()
        thread.join(timeout=1.5)


@router.get("/fleet")
async def live_fleet(
    request: Request,
    intervalMs: int = Query(1000, ge=100, le=30000),
    maxTicks: int = Query(60, ge=1, le=600),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    require_fleet_access(principal)
    company_id = principal.company_id

    def producer(db: Session, tick: int):
        overview = FleetService.overview(db, company_id=company_id)
        machines = FleetService.list_machines(db, company_id=company_id, limit=200)
        return [
            (
                "fleet.snapshot",
                {
                    "tick": tick,
                    "overview": overview,
                    "machines": machines,
                    "ts": datetime.utcnow().isoformat(),
                },
            )
        ]

    return StreamingResponse(
        _poll_stream(
            request,
            interval_sec=intervalMs / 1000.0,
            max_ticks=maxTicks,
            producer=producer,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/logs")
async def live_logs(
    request: Request,
    source: str = Query(
        "redis",
        description="redis = ingestion pub/sub live logs; db = poll Postgres/alerts",
    ),
    equipmentId: Optional[str] = Query(None),
    maxSeconds: int = Query(120, ge=5, le=3600),
    recentLimit: int = Query(40, ge=1, le=200),
    intervalMs: int = Query(1000, ge=100, le=30000),
    maxTicks: int = Query(60, ge=1, le=600),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    """
    Live machinery logs.

    Primary path: Redis channel published by IngestionService after each packet.
    Fallback: DB poll of recent alerts/telemetry when source=db.
    """
    require_fleet_access(principal)
    company_id = principal.company_id

    if source.lower() == "redis":
        return StreamingResponse(
            _redis_log_stream(
                request,
                company_id=company_id,
                equipment_id=equipmentId,
                max_seconds=float(maxSeconds),
                recent_limit=recentLimit,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    def producer(db: Session, tick: int):
        logs = FleetService.live_logs(
            db,
            company_id=company_id,
            equipment_id=int(equipmentId) if equipmentId and equipmentId.isdigit() else None,
            limit=20,
        )
        return [
            (
                "log.batch",
                {"tick": tick, "logs": logs, "ts": datetime.utcnow().isoformat(), "source": "db"},
            )
        ]

    return StreamingResponse(
        _poll_stream(
            request,
            interval_sec=intervalMs / 1000.0,
            max_ticks=maxTicks,
            producer=producer,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/alerts")
async def live_alerts(
    request: Request,
    intervalMs: int = Query(1000, ge=100, le=30000),
    maxTicks: int = Query(60, ge=1, le=600),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    require_fleet_access(principal)
    company_id = principal.company_id

    def producer(db: Session, tick: int):
        machines = FleetService.list_machines(
            db, company_id=company_id, has_alert=True, limit=100
        )
        open_alerts = []
        for m in machines:
            for a in FleetService.alerts_for_equipment(db, str(m["equipmentId"]), limit=5):
                if not a.get("isResolved"):
                    open_alerts.append(a)
        return [
            (
                "alerts.snapshot",
                {
                    "tick": tick,
                    "alerts": open_alerts[:50],
                    "count": len(open_alerts),
                    "ts": datetime.utcnow().isoformat(),
                },
            )
        ]

    return StreamingResponse(
        _poll_stream(
            request,
            interval_sec=intervalMs / 1000.0,
            max_ticks=maxTicks,
            producer=producer,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/geofences")
async def live_geofences(
    request: Request,
    maxSeconds: int = Query(300, ge=5, le=3600),
    recentLimit: int = Query(100, ge=1, le=200),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    require_fleet_access(principal)
    return StreamingResponse(
        _redis_geofence_stream(
            request,
            company_id=principal.company_id,
            max_seconds=float(maxSeconds),
            recent_limit=recentLimit,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/site/{site_id}")
async def live_site(
    site_id: int,
    request: Request,
    intervalMs: int = Query(1000, ge=100, le=30000),
    maxTicks: int = Query(60, ge=1, le=600),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    require_site_ops(principal)
    company_id = principal.company_id

    def producer(db: Session, tick: int):
        machines = FleetService.list_machines(
            db, company_id=company_id, site_id=site_id, limit=100
        )
        return [
            (
                "site.snapshot",
                {
                    "tick": tick,
                    "siteId": site_id,
                    "machines": machines,
                    "ts": datetime.utcnow().isoformat(),
                },
            )
        ]

    return StreamingResponse(
        _poll_stream(
            request,
            interval_sec=intervalMs / 1000.0,
            max_ticks=maxTicks,
            producer=producer,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/redis/status")
def live_redis_status(
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    require_fleet_access(principal)
    return {"success": True, "data": redis_status()}
