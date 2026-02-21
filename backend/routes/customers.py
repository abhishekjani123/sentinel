from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Customer, Event, Incident

router = APIRouter(prefix="/customers", tags=["customers"])


@router.get("")
async def list_customers(
    tier: Optional[str] = None,
    sort_by: str = Query(default="health_score", regex="^(health_score|name|error_rate|avg_latency)$"),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer)
    if tier:
        query = query.where(Customer.tier == tier)

    if sort_by == "health_score":
        query = query.order_by(Customer.health_score.asc())
    elif sort_by == "error_rate":
        query = query.order_by(desc(Customer.error_rate))
    elif sort_by == "avg_latency":
        query = query.order_by(desc(Customer.avg_latency))
    else:
        query = query.order_by(Customer.name)

    result = await db.execute(query)
    customers = result.scalars().all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "tier": c.tier,
            "health_score": round(c.health_score, 1),
            "total_events": c.total_events,
            "error_rate": round(c.error_rate, 4),
            "avg_latency": round(c.avg_latency, 2),
            "last_active": c.last_active.isoformat() if c.last_active else None,
        }
        for c in customers
    ]


@router.get("/{customer_id}")
async def get_customer(customer_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Customer not found")

    open_incidents = await db.execute(
        select(func.count(Incident.id)).where(
            Incident.customer_id == customer_id,
            Incident.status == "open",
        )
    )

    return {
        "id": customer.id,
        "name": customer.name,
        "tier": customer.tier,
        "health_score": round(customer.health_score, 1),
        "total_events": customer.total_events,
        "error_rate": round(customer.error_rate, 4),
        "avg_latency": round(customer.avg_latency, 2),
        "last_active": customer.last_active.isoformat() if customer.last_active else None,
        "open_incidents": open_incidents.scalar() or 0,
    }


@router.get("/{customer_id}/events")
async def get_customer_events(
    customer_id: str,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Event)
        .where(Event.customer_id == customer_id)
        .order_by(desc(Event.timestamp))
        .limit(limit)
    )
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "service": e.service,
            "event_type": e.event_type,
            "severity": e.severity,
            "message": e.message,
            "latency_ms": e.latency_ms,
            "status_code": e.status_code,
        }
        for e in events
    ]


@router.get("/{customer_id}/metrics")
async def get_customer_metrics(
    customer_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Time-series style metrics: error rate, avg latency, request count bucketed by minute."""
    from sqlalchemy import text

    query = text("""
        SELECT
            strftime('%Y-%m-%dT%H:%M:00', timestamp) as bucket,
            COUNT(*) as request_count,
            AVG(latency_ms) as avg_latency,
            SUM(CASE WHEN severity IN ('error', 'critical') THEN 1 ELSE 0 END) * 1.0 / COUNT(*) as error_rate
        FROM events
        WHERE customer_id = :cid
        GROUP BY bucket
        ORDER BY bucket DESC
        LIMIT 60
    """)
    result = await db.execute(query, {"cid": customer_id})
    rows = result.fetchall()
    return [
        {
            "bucket": row[0],
            "request_count": row[1],
            "avg_latency": round(row[2] or 0, 2),
            "error_rate": round(row[3] or 0, 4),
        }
        for row in reversed(rows)
    ]
