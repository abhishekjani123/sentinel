"""
Anomaly Detection Agent: statistical anomaly detection using z-scores.
Runs as a background task, checking for anomalies every 20 seconds.
When an anomaly is found, creates an incident and triggers the investigation agent.
"""

import asyncio
import math
from collections import defaultdict
from datetime import datetime, timedelta

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models import Customer, Event, Incident


class MetricHistory:
    """Rolling window of metric values for z-score computation."""

    def __init__(self, max_size=30):
        self.values: list[float] = []
        self.max_size = max_size

    def add(self, value: float):
        self.values.append(value)
        if len(self.values) > self.max_size:
            self.values.pop(0)

    @property
    def mean(self) -> float:
        return sum(self.values) / len(self.values) if self.values else 0

    @property
    def std(self) -> float:
        if len(self.values) < 2:
            return 0
        m = self.mean
        variance = sum((x - m) ** 2 for x in self.values) / (len(self.values) - 1)
        return math.sqrt(variance)

    def z_score(self, value: float) -> float:
        if self.std == 0:
            return 0
        return (value - self.mean) / self.std


error_rate_history: dict[str, MetricHistory] = defaultdict(MetricHistory)
latency_history: dict[str, MetricHistory] = defaultdict(MetricHistory)

Z_SCORE_THRESHOLD = 2.0
COOLDOWN_MINUTES = 3
last_incident_time: dict[str, datetime] = {}


async def check_for_anomalies(db: AsyncSession, customer_id: str) -> list[dict]:
    window = datetime.utcnow() - timedelta(minutes=2)

    total_q = await db.execute(
        select(func.count(Event.id)).where(
            Event.customer_id == customer_id,
            Event.timestamp >= window,
        )
    )
    total = total_q.scalar() or 0
    if total < 5:
        return []

    error_q = await db.execute(
        select(func.count(Event.id)).where(
            Event.customer_id == customer_id,
            Event.timestamp >= window,
            Event.severity.in_(["error", "critical"]),
        )
    )
    errors = error_q.scalar() or 0
    current_error_rate = errors / total

    latency_q = await db.execute(
        select(func.avg(Event.latency_ms)).where(
            Event.customer_id == customer_id,
            Event.timestamp >= window,
            Event.latency_ms.isnot(None),
        )
    )
    current_latency = latency_q.scalar() or 0

    anomalies = []

    error_rate_history[customer_id].add(current_error_rate)
    hist = error_rate_history[customer_id]
    z_err = hist.z_score(current_error_rate) if len(hist.values) >= 3 else 0

    if current_error_rate > 0.08 or (z_err > Z_SCORE_THRESHOLD and current_error_rate > 0.03):
        anomalies.append({
            "type": "error_spike",
            "severity": "critical" if current_error_rate > 0.15 or z_err > 4 else "warning",
            "title": f"Error rate spike: {current_error_rate:.1%} (z-score: {z_err:.1f})",
            "metrics": {"error_rate": current_error_rate, "z_score": round(z_err, 2)},
        })

    latency_history[customer_id].add(current_latency)
    hist_l = latency_history[customer_id]
    z_lat = hist_l.z_score(current_latency) if len(hist_l.values) >= 3 else 0

    if current_latency > 100 or (z_lat > Z_SCORE_THRESHOLD and current_latency > 60):
        anomalies.append({
            "type": "latency_spike",
            "severity": "critical" if current_latency > 200 or z_lat > 4 else "warning",
            "title": f"Latency spike: {current_latency:.0f}ms (z-score: {z_lat:.1f})",
            "metrics": {"avg_latency": round(current_latency, 2), "z_score": round(z_lat, 2)},
        })

    return anomalies


async def create_incident_if_new(db: AsyncSession, customer_id: str, anomaly: dict) -> bool:
    key = f"{customer_id}:{anomaly['type']}"
    now = datetime.utcnow()

    if key in last_incident_time:
        if (now - last_incident_time[key]).total_seconds() < COOLDOWN_MINUTES * 60:
            return False

    incident = Incident(
        customer_id=customer_id,
        type=anomaly["type"],
        severity=anomaly["severity"],
        title=anomaly["title"],
        status="open",
    )
    db.add(incident)
    await db.commit()
    await db.refresh(incident)

    last_incident_time[key] = now
    print(f"[DETECTOR] Incident #{incident.id} created: {anomaly['title']} for {customer_id}")

    asyncio.create_task(trigger_investigation(incident.id))
    return True


async def trigger_investigation(incident_id: int):
    try:
        from agents.investigator import investigate_incident
        await investigate_incident(incident_id)
    except Exception as e:
        print(f"[DETECTOR] Investigation failed for incident #{incident_id}: {e}")


async def run_anomaly_detector():
    print("[DETECTOR] Started")
    await asyncio.sleep(15)

    while True:
        try:
            async with async_session() as db:
                result = await db.execute(select(Customer))
                customers = result.scalars().all()

                for customer in customers:
                    anomalies = await check_for_anomalies(db, customer.id)
                    for anomaly in anomalies:
                        await create_incident_if_new(db, customer.id, anomaly)

        except Exception as e:
            print(f"[DETECTOR] Error: {e}")

        await asyncio.sleep(15)
