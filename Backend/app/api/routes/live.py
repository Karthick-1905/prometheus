"""SSE live streams for Fleet Manager / Site Manager dashboards."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime
from typing import AsyncIterator, Callable, Optional, Tuple

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


@router.get("/fleet")
async def live_fleet(
    request: Request,
    intervalMs: int = Query(500, ge=100, le=30000),
    maxTicks: int = Query(2, ge=1, le=120),
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
    intervalMs: int = Query(500, ge=100, le=30000),
    maxTicks: int = Query(2, ge=1, le=120),
    principal: DashboardPrincipal = Depends(get_dashboard_principal),
):
    require_fleet_access(principal)
    company_id = principal.company_id

    def producer(db: Session, tick: int):
        logs = FleetService.live_logs(db, company_id=company_id, limit=20)
        return [
            (
                "log.batch",
                {"tick": tick, "logs": logs, "ts": datetime.utcnow().isoformat()},
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
    intervalMs: int = Query(500, ge=100, le=30000),
    maxTicks: int = Query(2, ge=1, le=120),
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


@router.get("/site/{site_id}")
async def live_site(
    site_id: int,
    request: Request,
    intervalMs: int = Query(500, ge=100, le=30000),
    maxTicks: int = Query(2, ge=1, le=120),
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
