"""
Investigation Agent: uses Gemini AI to analyze incidents and determine root causes.
Falls back to rule-based analysis when the API key is not available.
"""

import os
from datetime import datetime, timedelta

from sqlalchemy import select, desc

from database import async_session
from models import Incident, Event

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")


async def investigate_incident(incident_id: int):
    async with async_session() as db:
        result = await db.execute(select(Incident).where(Incident.id == incident_id))
        incident = result.scalar_one_or_none()
        if not incident:
            return

        window = datetime.utcnow() - timedelta(minutes=5)
        events_q = await db.execute(
            select(Event)
            .where(
                Event.customer_id == incident.customer_id,
                Event.timestamp >= window,
            )
            .order_by(desc(Event.timestamp))
            .limit(50)
        )
        recent_events = events_q.scalars().all()

        events_summary = []
        for e in recent_events:
            events_summary.append({
                "service": e.service,
                "severity": e.severity,
                "message": e.message,
                "latency_ms": e.latency_ms,
                "status_code": e.status_code,
            })

        if GEMINI_API_KEY:
            summary, root_cause = await _gemini_investigate(incident, events_summary)
        else:
            summary, root_cause = _rule_based_investigate(incident, events_summary)

        incident.ai_summary = summary
        incident.root_cause = root_cause
        await db.commit()
        print(f"[INVESTIGATOR] Incident #{incident_id} analyzed: {root_cause[:80]}...")


async def _gemini_investigate(incident: Incident, events: list[dict]) -> tuple[str, str]:
    try:
        import google.generativeai as genai

        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel("gemini-2.0-flash")

        error_events = [e for e in events if e["severity"] in ("error", "critical")]
        services_affected = list(set(e["service"] for e in error_events))
        error_messages = list(set(e["message"] for e in error_events[:10]))

        prompt = f"""You are an SRE agent investigating a production incident.

Incident: {incident.title}
Customer: {incident.customer_id}
Type: {incident.type}
Severity: {incident.severity}

Recent events summary:
- Total events in last 5 min: {len(events)}
- Error events: {len(error_events)}
- Services with errors: {services_affected}
- Sample error messages: {error_messages[:5]}
- Avg latency of recent events: {sum(e['latency_ms'] or 0 for e in events) / max(len(events), 1):.0f}ms

Provide:
1. A concise 2-3 sentence summary of the incident
2. The most likely root cause (1-2 sentences)

Format your response as:
SUMMARY: <your summary>
ROOT_CAUSE: <your root cause analysis>"""

        response = await model.generate_content_async(prompt)
        text = response.text

        summary = ""
        root_cause = ""
        for line in text.strip().split("\n"):
            if line.startswith("SUMMARY:"):
                summary = line.replace("SUMMARY:", "").strip()
            elif line.startswith("ROOT_CAUSE:"):
                root_cause = line.replace("ROOT_CAUSE:", "").strip()

        if not summary:
            summary = text[:300]
        if not root_cause:
            root_cause = "Unable to determine specific root cause from available data."

        return summary, root_cause

    except Exception as e:
        print(f"[INVESTIGATOR] Gemini API error: {e}, falling back to rule-based")
        return _rule_based_investigate(incident, events)


def _rule_based_investigate(incident: Incident, events: list[dict]) -> tuple[str, str]:
    error_events = [e for e in events if e["severity"] in ("error", "critical")]
    services_affected = list(set(e["service"] for e in error_events))
    error_messages = [e["message"] for e in error_events]
    high_latency = [e for e in events if (e.get("latency_ms") or 0) > 200]

    if incident.type == "error_spike":
        error_rate = len(error_events) / max(len(events), 1)

        if any("database" in s for s in services_affected):
            root_cause = (
                "Database service is returning errors, likely due to connection pool exhaustion "
                "or query timeout. This is cascading to dependent services."
            )
        elif any("auth" in s for s in services_affected):
            root_cause = (
                "Authentication service failures detected. Possible causes: expired certificates, "
                "token validation service overloaded, or upstream identity provider issues."
            )
        elif any("payment" in s for s in services_affected):
            root_cause = (
                "Payment service returning 5xx errors. Likely an issue with the payment gateway "
                "integration or database connectivity from the payment service."
            )
        else:
            top_service = max(set(services_affected), key=services_affected.count) if services_affected else "unknown"
            root_cause = (
                f"Error spike concentrated in {top_service}. "
                f"Error rate: {error_rate:.1%}. "
                "Recommend checking recent deployments and service dependencies."
            )

        summary = (
            f"Detected error rate spike for customer {incident.customer_id}. "
            f"{len(error_events)} errors across {len(services_affected)} services "
            f"in the last 5 minutes. Primary services affected: {', '.join(services_affected[:3])}."
        )

    elif incident.type == "latency_spike":
        avg_latency = sum(e.get("latency_ms") or 0 for e in events) / max(len(events), 1)

        if any("database" in s for s in services_affected) or any("database" in (e.get("service") or "") for e in high_latency):
            root_cause = (
                "Latency spike correlated with database service. Likely slow queries, "
                "lock contention, or increased load causing connection queuing."
            )
        elif any("cache" in (e.get("service") or "") for e in events if e.get("severity") == "error"):
            root_cause = (
                "Cache layer experiencing issues, causing requests to fall through to "
                "the database. This is increasing overall response times."
            )
        else:
            root_cause = (
                f"Latency elevated to {avg_latency:.0f}ms average. "
                "Possible causes: increased traffic, resource contention, or "
                "downstream service degradation."
            )

        summary = (
            f"Latency spike detected for customer {incident.customer_id}. "
            f"Average response time: {avg_latency:.0f}ms. "
            f"{len(high_latency)} requests exceeded 200ms threshold."
        )

    else:
        summary = f"Anomaly detected for customer {incident.customer_id}: {incident.title}"
        root_cause = "Further investigation needed. Review recent deployments and service logs."

    return summary, root_cause
