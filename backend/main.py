import asyncio
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from database import init_db
from routes.events import router as events_router
from routes.customers import router as customers_router
from routes.incidents import router as incidents_router
from routes.services import router as services_router

background_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_initial_data()

    from agents.health import run_health_engine
    from agents.detector import run_anomaly_detector
    from simulator import run_simulator

    background_tasks.append(asyncio.create_task(run_health_engine()))
    background_tasks.append(asyncio.create_task(run_anomaly_detector()))

    if os.environ.get("ENABLE_SIMULATOR", "true").lower() == "true":
        background_tasks.append(asyncio.create_task(run_simulator()))

    yield

    for task in background_tasks:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Sentinel", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(events_router, prefix="/api")
app.include_router(customers_router, prefix="/api")
app.include_router(incidents_router, prefix="/api")
app.include_router(services_router, prefix="/api")


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "sentinel"}


FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"
if FRONTEND_DIR.is_dir():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")


async def seed_initial_data():
    from database import async_session
    from models import Customer, Service
    from sqlalchemy import select

    async with async_session() as db:
        existing = await db.execute(select(Customer).limit(1))
        if existing.scalar_one_or_none():
            return

        customers = [
            Customer(id="acme", name="Acme Corporation", tier="enterprise", health_score=100),
            Customer(id="globex", name="Globex Industries", tier="enterprise", health_score=100),
            Customer(id="initech", name="Initech Solutions", tier="pro", health_score=100),
            Customer(id="umbrella", name="Umbrella Labs", tier="pro", health_score=100),
            Customer(id="wayne", name="Wayne Enterprises", tier="enterprise", health_score=100),
            Customer(id="stark", name="Stark Technologies", tier="pro", health_score=100),
        ]

        services = [
            Service(id="api-gateway", name="API Gateway", dependencies=["auth-service", "user-service"]),
            Service(id="auth-service", name="Auth Service", dependencies=["user-service", "cache"]),
            Service(id="user-service", name="User Service", dependencies=["database"]),
            Service(id="payment-service", name="Payment Service", dependencies=["api-gateway", "database"]),
            Service(id="database", name="Database", dependencies=[]),
            Service(id="cache", name="Cache (Redis)", dependencies=[]),
        ]

        db.add_all(customers + services)
        await db.commit()
