import asyncio
import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Event

router = APIRouter(prefix="/events", tags=["events"])

event_subscribers: list[asyncio.Queue] = []


def parse_ts(value) -> datetime:
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        for fmt in ("%Y-%m-%dT%H:%M:%S.%f", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.fromisoformat(value)
            except (ValueError, TypeError):
                pass
    return datetime.utcnow()


@router.post("")
async def ingest_event(payload: dict, db: AsyncSession = Depends(get_db)):
    event = Event(
        timestamp=parse_ts(payload.get("timestamp")),
        customer_id=payload["customer_id"],
        service=payload["service"],
        event_type=payload.get("event_type", "request"),
        severity=payload.get("severity", "info"),
        message=payload.get("message", ""),
        latency_ms=payload.get("latency_ms"),
        status_code=payload.get("status_code"),
        metadata_=payload.get("metadata", {}),
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)

    broadcast = {
        "id": event.id,
        "timestamp": event.timestamp.isoformat() if event.timestamp else None,
        "customer_id": event.customer_id,
        "service": event.service,
        "event_type": event.event_type,
        "severity": event.severity,
        "message": event.message,
        "latency_ms": event.latency_ms,
        "status_code": event.status_code,
    }
    for q in event_subscribers:
        await q.put(broadcast)

    return {"id": event.id, "status": "ingested"}


@router.post("/batch")
async def ingest_batch(events: list[dict], db: AsyncSession = Depends(get_db)):
    created = []
    for payload in events:
        event = Event(
            timestamp=parse_ts(payload.get("timestamp")),
            customer_id=payload["customer_id"],
            service=payload["service"],
            event_type=payload.get("event_type", "request"),
            severity=payload.get("severity", "info"),
            message=payload.get("message", ""),
            latency_ms=payload.get("latency_ms"),
            status_code=payload.get("status_code"),
            metadata_=payload.get("metadata", {}),
        )
        db.add(event)
        created.append(event)

    await db.commit()

    for event in created:
        await db.refresh(event)
        broadcast = {
            "id": event.id,
            "timestamp": event.timestamp.isoformat() if event.timestamp else None,
            "customer_id": event.customer_id,
            "service": event.service,
            "event_type": event.event_type,
            "severity": event.severity,
            "message": event.message,
            "latency_ms": event.latency_ms,
            "status_code": event.status_code,
        }
        for q in event_subscribers:
            await q.put(broadcast)

    return {"count": len(created), "status": "ingested"}


@router.get("")
async def list_events(
    customer_id: Optional[str] = None,
    service: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
):
    query = select(Event).order_by(desc(Event.timestamp))
    if customer_id:
        query = query.where(Event.customer_id == customer_id)
    if service:
        query = query.where(Event.service == service)
    if severity:
        query = query.where(Event.severity == severity)
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "customer_id": e.customer_id,
            "service": e.service,
            "event_type": e.event_type,
            "severity": e.severity,
            "message": e.message,
            "latency_ms": e.latency_ms,
            "status_code": e.status_code,
        }
        for e in events
    ]


@router.get("/stats")
async def event_stats(db: AsyncSession = Depends(get_db)):
    total = await db.execute(select(func.count(Event.id)))
    errors = await db.execute(
        select(func.count(Event.id)).where(Event.severity.in_(["error", "critical"]))
    )
    avg_latency = await db.execute(
        select(func.avg(Event.latency_ms)).where(Event.latency_ms.isnot(None))
    )
    return {
        "total_events": total.scalar() or 0,
        "total_errors": errors.scalar() or 0,
        "avg_latency_ms": round(avg_latency.scalar() or 0, 2),
    }


@router.get("/stream")
async def event_stream():
    from fastapi.responses import StreamingResponse

    queue: asyncio.Queue = asyncio.Queue()
    event_subscribers.append(queue)

    async def generate():
        try:
            while True:
                try:
                    data = await asyncio.wait_for(queue.get(), timeout=15)
                    yield f"data: {json.dumps(data)}\n\n"
                except asyncio.TimeoutError:
                    yield f"data: {json.dumps({'type': 'heartbeat'})}\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            if queue in event_subscribers:
                event_subscribers.remove(queue)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
