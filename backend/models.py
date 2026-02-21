from sqlalchemy import Column, Integer, String, Float, DateTime, Text, JSON
from sqlalchemy.sql import func
from database import Base


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, server_default=func.now(), index=True)
    customer_id = Column(String(50), index=True, nullable=False)
    service = Column(String(100), index=True, nullable=False)
    event_type = Column(String(50), nullable=False)
    severity = Column(String(20), default="info")
    message = Column(Text, default="")
    latency_ms = Column(Float, nullable=True)
    status_code = Column(Integer, nullable=True)
    metadata_ = Column("metadata", JSON, default=dict)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    tier = Column(String(20), default="free")
    health_score = Column(Float, default=100.0)
    total_events = Column(Integer, default=0)
    error_rate = Column(Float, default=0.0)
    avg_latency = Column(Float, default=0.0)
    last_active = Column(DateTime, server_default=func.now())


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(String(50), index=True, nullable=False)
    detected_at = Column(DateTime, server_default=func.now())
    resolved_at = Column(DateTime, nullable=True)
    type = Column(String(50), nullable=False)
    severity = Column(String(20), default="warning")
    title = Column(String(500), nullable=False)
    ai_summary = Column(Text, default="")
    root_cause = Column(Text, default="")
    status = Column(String(20), default="open")


class Service(Base):
    __tablename__ = "services"

    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    dependencies = Column(JSON, default=list)
    health_score = Column(Float, default=100.0)
