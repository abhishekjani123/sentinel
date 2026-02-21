"""
Event simulator that generates realistic telemetry data.
Simulates normal traffic patterns with periodic anomaly injection.
Can run standalone or be imported as a module.
"""

import asyncio
import random
import time
from datetime import datetime

import httpx

API_URL = "http://localhost:8000/api/events/batch"

CUSTOMERS = ["acme", "globex", "initech", "umbrella", "wayne", "stark"]

SERVICES = ["api-gateway", "auth-service", "user-service", "payment-service", "database", "cache"]

NORMAL_LATENCY = {
    "api-gateway": (20, 80),
    "auth-service": (10, 50),
    "user-service": (15, 60),
    "payment-service": (30, 120),
    "database": (5, 30),
    "cache": (1, 10),
}

EVENT_TYPES = ["request", "query", "auth_check", "payment", "cache_hit", "cache_miss"]

ERROR_MESSAGES = [
    "Connection timeout after 30s",
    "Internal server error: null pointer exception",
    "Database connection pool exhausted",
    "Rate limit exceeded for client",
    "Authentication token expired",
    "Payment gateway returned 502",
    "Cache eviction under memory pressure",
    "Service discovery: upstream host not found",
    "TLS handshake failed: certificate expired",
    "Request body too large: 10MB limit exceeded",
]

SUCCESS_MESSAGES = [
    "Request processed successfully",
    "Query executed in normal time",
    "Authentication validated",
    "Payment processed",
    "Cache hit for session data",
    "User profile fetched",
]


class AnomalyState:
    def __init__(self):
        self.active_anomaly = None
        self.anomaly_start = 0
        self.anomaly_duration = 0

    def maybe_start_anomaly(self):
        if self.active_anomaly:
            if time.time() - self.anomaly_start > self.anomaly_duration:
                self.active_anomaly = None
                return
            return

        if random.random() < 0.06:
            self.active_anomaly = {
                "type": random.choice(["latency_spike", "error_burst", "service_degradation"]),
                "customer": random.choice(CUSTOMERS),
                "service": random.choice(SERVICES),
            }
            self.anomaly_start = time.time()
            self.anomaly_duration = random.uniform(30, 90)
            print(f"[ANOMALY] Started: {self.active_anomaly['type']} for "
                  f"{self.active_anomaly['customer']} on {self.active_anomaly['service']} "
                  f"(duration: {self.anomaly_duration:.0f}s)")


def generate_event(customer_id: str, service: str, anomaly: AnomalyState) -> dict:
    is_anomaly_target = (
        anomaly.active_anomaly
        and anomaly.active_anomaly["customer"] == customer_id
        and anomaly.active_anomaly["service"] == service
    )

    low, high = NORMAL_LATENCY.get(service, (10, 50))

    is_anomaly_customer = (
        anomaly.active_anomaly
        and anomaly.active_anomaly["customer"] == customer_id
    )

    if is_anomaly_target and anomaly.active_anomaly["type"] == "latency_spike":
        latency = random.uniform(high * 8, high * 20)
        severity = "error"
        message = f"Elevated latency: {latency:.0f}ms (normal: {low}-{high}ms)"
        status_code = 200
    elif is_anomaly_customer and anomaly.active_anomaly["type"] == "latency_spike":
        latency = random.uniform(high * 2, high * 5)
        severity = "warning"
        message = f"Elevated latency: {latency:.0f}ms"
        status_code = 200
    elif is_anomaly_target and anomaly.active_anomaly["type"] == "error_burst":
        latency = random.uniform(low, high * 2)
        severity = random.choice(["error", "critical"])
        message = random.choice(ERROR_MESSAGES)
        status_code = random.choice([500, 502, 503, 504, 429])
    elif is_anomaly_customer and anomaly.active_anomaly["type"] == "error_burst":
        if random.random() < 0.4:
            latency = random.uniform(low, high)
            severity = "error"
            message = random.choice(ERROR_MESSAGES)
            status_code = random.choice([500, 502, 503])
        else:
            latency = random.uniform(low, high)
            severity = "info"
            message = random.choice(SUCCESS_MESSAGES)
            status_code = 200
    elif is_anomaly_target and anomaly.active_anomaly["type"] == "service_degradation":
        latency = random.uniform(high * 4, high * 10)
        severity = "error"
        message = random.choice(ERROR_MESSAGES)
        status_code = random.choice([500, 502, 503])
    elif is_anomaly_customer and anomaly.active_anomaly["type"] == "service_degradation":
        latency = random.uniform(high * 1.5, high * 3)
        if random.random() < 0.3:
            severity = "error"
            message = random.choice(ERROR_MESSAGES)
            status_code = random.choice([500, 502])
        else:
            severity = "warning"
            message = f"Degraded response from {service}"
            status_code = 200
    else:
        latency = random.uniform(low, high)
        if random.random() < 0.02:
            severity = "error"
            message = random.choice(ERROR_MESSAGES)
            status_code = random.choice([500, 502, 503])
        else:
            severity = "info"
            message = random.choice(SUCCESS_MESSAGES)
            status_code = 200

    return {
        "timestamp": datetime.utcnow().isoformat(),
        "customer_id": customer_id,
        "service": service,
        "event_type": random.choice(EVENT_TYPES),
        "severity": severity,
        "message": message,
        "latency_ms": round(latency, 2),
        "status_code": status_code,
        "metadata": {
            "region": random.choice(["us-east-1", "us-west-2", "eu-west-1"]),
            "version": random.choice(["v2.1.0", "v2.1.1", "v2.2.0-beta"]),
        },
    }


async def run_simulator():
    anomaly = AnomalyState()
    print("[SIMULATOR] Starting event generation...")
    print(f"[SIMULATOR] Customers: {CUSTOMERS}")
    print(f"[SIMULATOR] Services: {SERVICES}")

    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            anomaly.maybe_start_anomaly()

            batch = []
            for _ in range(random.randint(5, 15)):
                customer = random.choice(CUSTOMERS)
                service = random.choice(SERVICES)
                batch.append(generate_event(customer, service, anomaly))

            try:
                resp = await client.post(API_URL, json=batch)
                if resp.status_code == 200:
                    data = resp.json()
                    print(f"[SIMULATOR] Sent {data['count']} events"
                          + (f" | Active anomaly: {anomaly.active_anomaly['type']}"
                             if anomaly.active_anomaly else ""))
                else:
                    print(f"[SIMULATOR] Error: {resp.status_code}")
            except Exception as e:
                print(f"[SIMULATOR] Connection failed: {e}")

            await asyncio.sleep(random.uniform(1.0, 3.0))


if __name__ == "__main__":
    asyncio.run(run_simulator())
