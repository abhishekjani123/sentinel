from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Incident

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("")
async def list_incidents(
    customer_id: Optional[str] = None,
    status: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    query = select(Incident).order_by(desc(Incident.detected_at))
    if customer_id:
        query = query.where(Incident.customer_id == customer_id)
    if status:
        query = query.where(Incident.status == status)
    if severity:
        query = query.where(Incident.severity == severity)
    query = query.limit(limit)

    result = await db.execute(query)
    incidents = result.scalars().all()
    return [
        {
            "id": i.id,
            "customer_id": i.customer_id,
            "detected_at": i.detected_at.isoformat() if i.detected_at else None,
            "resolved_at": i.resolved_at.isoformat() if i.resolved_at else None,
            "type": i.type,
            "severity": i.severity,
            "title": i.title,
            "ai_summary": i.ai_summary,
            "root_cause": i.root_cause,
            "status": i.status,
        }
        for i in incidents
    ]


@router.get("/{incident_id}")
async def get_incident(incident_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = result.scalar_one_or_none()
    if not inc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found")

    return {
        "id": inc.id,
        "customer_id": inc.customer_id,
        "detected_at": inc.detected_at.isoformat() if inc.detected_at else None,
        "resolved_at": inc.resolved_at.isoformat() if inc.resolved_at else None,
        "type": inc.type,
        "severity": inc.severity,
        "title": inc.title,
        "ai_summary": inc.ai_summary,
        "root_cause": inc.root_cause,
        "status": inc.status,
    }


@router.patch("/{incident_id}")
async def update_incident(incident_id: int, payload: dict, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Incident).where(Incident.id == incident_id))
    inc = result.scalar_one_or_none()
    if not inc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Incident not found")

    for field in ("status", "severity", "ai_summary", "root_cause", "resolved_at"):
        if field in payload:
            setattr(inc, field, payload[field])

    await db.commit()
    await db.refresh(inc)
    return {"id": inc.id, "status": inc.status}
