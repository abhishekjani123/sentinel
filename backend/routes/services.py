from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Service

router = APIRouter(prefix="/services", tags=["services"])


@router.get("")
async def list_services(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service))
    services = result.scalars().all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "dependencies": s.dependencies or [],
            "health_score": round(s.health_score, 1),
        }
        for s in services
    ]


@router.get("/{service_id}")
async def get_service(service_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Service).where(Service.id == service_id))
    svc = result.scalar_one_or_none()
    if not svc:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Service not found")

    return {
        "id": svc.id,
        "name": svc.name,
        "dependencies": svc.dependencies or [],
        "health_score": round(svc.health_score, 1),
    }
