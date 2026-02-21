import { useState, useMemo, useRef, useEffect } from 'react';
import { useSSE } from '../hooks/useSSE';
import type { EventData } from '../lib/api';

const severityStyles: Record<string, { bg: string; text: string }> = {
  info: { bg: 'transparent', text: '#71717a' },
  warning: { bg: 'var(--color-yellow-dim)', text: '#FFB800' },
  error: { bg: 'var(--color-red-dim)', text: '#FF5000' },
  critical: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
};

function EventRow({ event }: { event: EventData }) {
  const sev = severityStyles[event.severity] || severityStyles.info;
  const isError = event.severity === 'error' || event.severity === 'critical';
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 border-b table-row-hover animate-slide-in"
      style={{
        borderColor: 'var(--color-border)',
        background: isError ? 'rgba(255,80,0,0.03)' : 'transparent',
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: sev.text, boxShadow: isError ? `0 0 6px ${sev.text}55` : 'none' }} />
      <span className="text-[11px] font-mono w-[75px] flex-shrink-0 tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
        {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '--:--:--'}
      </span>
      <span className="text-[12px] font-medium w-[100px] truncate flex-shrink-0 capitalize" style={{ color: 'var(--color-blue)' }}>
        {event.customer_id}
      </span>
      <span className="text-[11px] font-mono w-[140px] truncate flex-shrink-0 text-white">
        {event.service}
      </span>
      <span className="text-[10px] px-2.5 py-0.5 rounded-lg font-semibold flex-shrink-0 uppercase tracking-[0.04em] min-w-[60px] text-center"
        style={{ background: sev.bg, color: sev.text, border: isError ? `1px solid ${sev.text}22` : '1px solid transparent' }}>
        {event.severity}
      </span>
      <span className="text-[11px] font-mono w-[60px] text-right flex-shrink-0 tabular-nums"
        style={{ color: event.latency_ms && event.latency_ms > 200 ? 'var(--color-yellow)' : 'var(--color-text-muted)' }}>
        {event.latency_ms?.toFixed(0) ?? '-'}ms
      </span>
      <span className="text-[11px] truncate flex-1" style={{ color: 'var(--color-text-muted)' }}>
        {event.message}
      </span>
    </div>
  );
}

type SeverityFilter = 'all' | 'errors' | 'warnings';

export default function LiveFeed() {
  const { events, connected } = useSSE('/api/events/stream');
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [activeCustomers, setActiveCustomers] = useState<Set<string>>(new Set());
  const [paused, setPaused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allCustomers = useMemo(() => {
    const set = new Set<string>();
    events.forEach(e => set.add(e.customer_id));
    return Array.from(set).sort();
  }, [events]);

  const toggleCustomer = (id: string) => {
    setActiveCustomers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredEvents = useMemo(() => {
    let filtered = events;
    if (severityFilter === 'errors') {
      filtered = filtered.filter(e => e.severity === 'error' || e.severity === 'critical');
    } else if (severityFilter === 'warnings') {
      filtered = filtered.filter(e => e.severity === 'warning' || e.severity === 'error' || e.severity === 'critical');
    }
    if (activeCustomers.size > 0) {
      filtered = filtered.filter(e => activeCustomers.has(e.customer_id));
    }
    return filtered;
  }, [events, severityFilter, activeCustomers]);

  const liveStats = useMemo(() => {
    const total = events.length;
    const errors = events.filter(e => e.severity === 'error' || e.severity === 'critical').length;
    const errorRate = total > 0 ? (errors / total) * 100 : 0;
    const latencies = events.filter(e => e.latency_ms != null).map(e => e.latency_ms!);
    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    return { total, errors, errorRate, avgLatency };
  }, [events]);

  useEffect(() => {
    if (!paused && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [events, paused]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[32px] font-bold tracking-[-0.03em] text-white">Live Feed</h2>
          <p className="text-[14px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Real-time telemetry event stream
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Pause/Live toggle */}
          <button
            onClick={() => setPaused(!paused)}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium transition-all"
            style={{
              background: paused ? 'var(--color-yellow-dim)' : 'rgba(255,255,255,0.04)',
              color: paused ? 'var(--color-yellow)' : 'var(--color-text-muted)',
              border: `1px solid ${paused ? 'rgba(255,184,0,0.2)' : 'var(--color-border)'}`,
            }}
          >
            {paused ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            )}
            {paused ? 'Paused' : 'Live'}
          </button>

          {/* Connection status */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full text-[12px] font-medium"
            style={{
              background: connected ? 'var(--color-green-dim)' : 'var(--color-red-dim)',
              color: connected ? 'var(--color-green)' : 'var(--color-red)',
              border: `1px solid ${connected ? 'rgba(0,200,5,0.2)' : 'rgba(255,80,0,0.2)'}`,
            }}>
            <span className="w-1.5 h-1.5 rounded-full"
              style={{
                background: connected ? 'var(--color-green)' : 'var(--color-red)',
                boxShadow: connected ? '0 0 6px rgba(0,200,5,0.5)' : 'none',
                animation: connected ? 'pulse-glow 2s infinite' : 'none',
              }} />
            {connected ? 'Connected' : 'Reconnecting...'}
          </div>
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: 'Events', value: liveStats.total.toLocaleString(), color: 'var(--color-blue)' },
          { label: 'Errors', value: liveStats.errors.toLocaleString(), color: 'var(--color-red)' },
          { label: 'Error Rate', value: `${liveStats.errorRate.toFixed(1)}%`, color: liveStats.errorRate > 5 ? 'var(--color-red)' : 'var(--color-green)' },
          { label: 'Avg Latency', value: `${liveStats.avgLatency.toFixed(0)}ms`, color: liveStats.avgLatency > 100 ? 'var(--color-yellow)' : 'var(--color-green)' },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ '--accent-color': s.color } as React.CSSProperties}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {s.label}
            </p>
            <p className="text-[24px] font-bold tracking-[-0.02em] leading-none tabular-nums" style={{ color: s.color }}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Severity filter */}
        <div className="flex p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
          {([
            { id: 'all' as SeverityFilter, label: 'All Events' },
            { id: 'warnings' as SeverityFilter, label: 'Warnings+' },
            { id: 'errors' as SeverityFilter, label: 'Errors Only' },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => setSeverityFilter(f.id)}
              className={`filter-pill ${severityFilter === f.id ? 'filter-pill-active' : 'filter-pill-inactive'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Customer pills */}
        {allCustomers.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] mr-1" style={{ color: 'var(--color-text-muted)' }}>
              Customer:
            </span>
            {allCustomers.map(c => (
              <button
                key={c}
                onClick={() => toggleCustomer(c)}
                className={`mini-pill capitalize ${activeCustomers.has(c) ? 'mini-pill-active' : ''}`}
              >
                {c}
              </button>
            ))}
            {activeCustomers.size > 0 && (
              <button
                onClick={() => setActiveCustomers(new Set())}
                className="mini-pill text-[10px]"
                style={{ color: 'var(--color-red)' }}
              >
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Event Table */}
      <div className="glass-card-static overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3.5 text-[10px] font-semibold uppercase tracking-[0.08em] border-b"
          style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
          <span className="w-1.5" />
          <span className="w-[75px]">Time</span>
          <span className="w-[100px]">Customer</span>
          <span className="w-[140px]">Service</span>
          <span className="w-[60px] text-center">Severity</span>
          <span className="w-[60px] text-right">Latency</span>
          <span className="flex-1">Message</span>
        </div>

        <div ref={scrollRef} className="max-h-[500px] overflow-y-auto">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 loading-shimmer"
                style={{ background: 'rgba(255,255,255,0.03)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              </div>
              <p className="text-[14px] font-medium text-white">
                {events.length === 0 ? 'Waiting for events' : 'No matching events'}
              </p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                {events.length === 0 ? 'Start the simulator to see live data' : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            filteredEvents.map((event, i) => <EventRow key={`${event.id}-${i}`} event={event} />)
          )}
        </div>

        {/* Footer with count */}
        {filteredEvents.length > 0 && (
          <div className="px-5 py-2.5 border-t flex items-center justify-between"
            style={{ borderColor: 'var(--color-border)', background: 'rgba(255,255,255,0.015)' }}>
            <span className="text-[11px] tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
              Showing {filteredEvents.length} of {events.length} events
            </span>
            {paused && (
              <span className="text-[11px] font-medium" style={{ color: 'var(--color-yellow)' }}>
                Auto-scroll paused
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
