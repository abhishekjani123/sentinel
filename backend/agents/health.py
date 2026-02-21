"""
Customer Health Engine: computes per-customer health scores.
Weighted factors: error rate (40%), p95 latency (30%), availability (30%).
Runs as a background task, updating every 15 seconds.
"""

import asyncio
from datetime import datetime, timedelta

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models import Customer, Event, Service


async def compute_health_score(db: AsyncSession, customer_id: str) -> dict:
    window = datetime.utcnow() - timedelta(minutes=5)

    total_q = await db.execute(
        select(func.count(Event.id)).where(
            Event.customer_id == customer_id,
            Event.timestamp >= window,
        )
    )
    total = total_q.scalar() or 0

    if total == 0:
        return {"health_score": 100, "error_rate": 0, "avg_latency": 0, "total_events": 0}

    error_q = await db.execute(
        select(func.count(Event.id)).where(
            Event.customer_id == customer_id,
            Event.timestamp >= window,
            Event.severity.in_(["error", "critical"]),
        )
    )
    errors = error_q.scalar() or 0
    error_rate = errors / total

    latency_q = await db.execute(
        select(func.avg(Event.latency_ms)).where(
            Event.customer_id == customer_id,
            Event.timestamp >= window,
            Event.latency_ms.isnot(None),
        )
    )
    avg_latency = latency_q.scalar() or 0

    p95_q = await db.execute(
        text("""
            SELECT latency_ms FROM events
            WHERE customer_id = :cid AND timestamp >= :window AND latency_ms IS NOT NULL
            ORDER BY latency_ms DESC
            LIMIT 1 OFFSET (
                SELECT CAST(COUNT(*) * 0.05 AS INTEGER) FROM events
                WHERE customer_id = :cid AND timestamp >= :window AND latency_ms IS NOT NULL
            )
        """),
        {"cid": customer_id, "window": window},
    )
    p95_row = p95_q.fetchone()
    p95_latency = p95_row[0] if p95_row else avg_latency

    error_score = max(0, 100 - (error_rate * 500))
    latency_score = max(0, 100 - max(0, (p95_latency - 100) * 0.5))
    availability_score = max(0, (1 - error_rate) * 100)

    health_score = (error_score * 0.4) + (latency_score * 0.3) + (availability_score * 0.3)
    health_score = max(0, min(100, health_score))

    return {
        "health_score": round(health_score, 1),
        "error_rate": round(error_rate, 4),
        "avg_latency": round(avg_latency, 2),
        "total_events": total,
    }


async def update_service_health(db: AsyncSession):
    window = datetime.utcnow() - timedelta(minutes=5)

    result = await db.execute(select(Service))
    services = result.scalars().all()

    for svc in services:
        total_q = await db.execute(
            select(func.count(Event.id)).where(
                Event.service == svc.id,
                Event.timestamp >= window,
            )
        )
        total = total_q.scalar() or 0
        if total == 0:
            svc.health_score = 100.0
            continue

        error_q = await db.execute(
            select(func.count(Event.id)).where(
                Event.service == svc.id,
                Event.timestamp >= window,
                Event.severity.in_(["error", "critical"]),
            )
        )
        errors = error_q.scalar() or 0
        error_rate = errors / total
        svc.health_score = round(max(0, min(100, (1 - error_rate * 5) * 100)), 1)

    await db.commit()


async def run_health_engine():
    print("[HEALTH ENGINE] Started")
    while True:
        try:
            async with async_session() as db:
                result = await db.execute(select(Customer))
                customers = result.scalars().all()

                for customer in customers:
                    metrics = await compute_health_score(db, customer.id)
                    customer.health_score = metrics["health_score"]
                    customer.error_rate = metrics["error_rate"]
                    customer.avg_latency = metrics["avg_latency"]
                    customer.total_events = metrics["total_events"]
                    customer.last_active = datetime.utcnow()

                await db.commit()
                await update_service_health(db)

        except Exception as e:
            print(f"[HEALTH ENGINE] Error: {e}")

        await asyncio.sleep(15)
