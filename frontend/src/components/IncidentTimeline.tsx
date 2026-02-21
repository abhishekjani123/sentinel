import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Incident } from '../lib/api';

const severityConfig: Record<string, { bg: string; text: string; glow: string }> = {
  critical: { bg: 'var(--color-red-dim)', text: 'var(--color-red)', glow: 'rgba(255,80,0,0.3)' },
  warning: { bg: 'var(--color-yellow-dim)', text: 'var(--color-yellow)', glow: 'rgba(255,184,0,0.3)' },
  info: { bg: 'rgba(255,255,255,0.04)', text: 'var(--color-text-muted)', glow: 'none' },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  open: { bg: 'var(--color-red-dim)', text: 'var(--color-red)' },
  investigating: { bg: 'var(--color-yellow-dim)', text: 'var(--color-yellow)' },
  resolved: { bg: 'var(--color-green-dim)', text: 'var(--color-green)' },
};

type ViewMode = 'timeline' | 'by-customer' | 'by-severity';

function IncidentCard({ inc, index }: { inc: Incident; index: number }) {
  const sev = severityConfig[inc.severity] || severityConfig.info;
  const stat = statusConfig[inc.status] || statusConfig.open;

  return (
    <div className="glass-card p-6 animate-fade-in" style={{ animationDelay: `${index * 40}ms` }}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 w-3 h-3 rounded-full flex-shrink-0"
            style={{ background: sev.text, boxShadow: `0 0 10px ${sev.glow}` }} />
          <div>
            <h3 className="font-semibold text-[15px] text-white leading-snug">{inc.title}</h3>
            <div className="flex items-center gap-2.5 mt-1.5">
              <Link to={`/customers/${inc.customer_id}`}
                className="text-[12px] font-medium transition-colors hover:text-white" style={{ color: 'var(--color-blue)' }}>
                {inc.customer_id}
              </Link>
              <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                {inc.detected_at ? new Date(inc.detected_at).toLocaleString() : ''}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-[0.06em]"
            style={{ background: sev.bg, color: sev.text }}>
            {inc.severity}
          </span>
          <span className="text-[10px] px-2.5 py-1 rounded-lg font-semibold uppercase tracking-[0.06em]"
            style={{ background: stat.bg, color: stat.text }}>
            {inc.status}
          </span>
        </div>
      </div>

      {(inc.ai_summary || inc.root_cause) && (
        <div className="ml-6 space-y-3 p-5 rounded-xl" style={{ background: 'rgba(255,255,255,0.015)', border: '1px solid var(--color-border)' }}>
          {inc.ai_summary && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
                </svg>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--color-blue)' }}>AI Summary</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {inc.ai_summary}
              </p>
            </div>
          )}
          {inc.root_cause && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-yellow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--color-yellow)' }}>Root Cause</span>
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                {inc.root_cause}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SeveritySection({ label, color, incidents, defaultOpen = true }: {
  label: string; color: string; incidents: Incident[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (incidents.length === 0) return null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="collapsible-header w-full flex items-center gap-3 px-4 py-3"
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color, boxShadow: `0 0 8px ${color}44` }} />
        <span className="text-[14px] font-bold text-white flex-1 text-left">{label}</span>
        <span className="text-[10px] px-2.5 py-1 rounded-lg font-semibold tabular-nums"
          style={{ background: `${color}18`, color }}>
          {incidents.length}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="space-y-3 pl-2">
          {incidents.map((inc, i) => <IncidentCard key={inc.id} inc={inc} index={i} />)}
        </div>
      )}
    </div>
  );
}

function CustomerSection({ customerId, incidents }: { customerId: string; incidents: Incident[] }) {
  const [open, setOpen] = useState(true);
  const critCount = incidents.filter(i => i.severity === 'critical').length;
  const warnCount = incidents.filter(i => i.severity === 'warning').length;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setOpen(!open)}
        className="collapsible-header w-full flex items-center gap-3 px-4 py-3"
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-[12px] font-bold uppercase"
          style={{ background: 'rgba(91,127,255,0.1)', color: 'var(--color-blue)' }}>
          {customerId.slice(0, 2)}
        </div>
        <div className="flex-1 text-left">
          <span className="text-[14px] font-bold text-white capitalize">{customerId}</span>
          <div className="flex items-center gap-2 mt-0.5">
            {critCount > 0 && (
              <span className="text-[10px] font-medium" style={{ color: 'var(--color-red)' }}>
                {critCount} critical
              </span>
            )}
            {warnCount > 0 && (
              <span className="text-[10px] font-medium" style={{ color: 'var(--color-yellow)' }}>
                {warnCount} warning
              </span>
            )}
          </div>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-lg font-semibold tabular-nums"
          style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--color-text-secondary)' }}>
          {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
        </span>
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="space-y-3 pl-2">
          {incidents.map((inc, i) => <IncidentCard key={inc.id} inc={inc} index={i} />)}
        </div>
      )}
    </div>
  );
}

export default function IncidentTimeline() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const params: { status?: string } = {};
      if (filter !== 'all') params.status = filter;
      const data = await api.getIncidents(params);
      setIncidents(data);
    } catch (e) {
      console.error('Failed to fetch incidents:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [filter]);

  const kpiCounts = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter(i => i.severity === 'critical').length;
    const warning = incidents.filter(i => i.severity === 'warning').length;
    const resolved = incidents.filter(i => i.status === 'resolved').length;
    return { total, critical, warning, resolved };
  }, [incidents]);

  const groupedBySeverity = useMemo(() => {
    const critical = incidents.filter(i => i.severity === 'critical');
    const warning = incidents.filter(i => i.severity === 'warning');
    const info = incidents.filter(i => i.severity !== 'critical' && i.severity !== 'warning');
    return { critical, warning, info };
  }, [incidents]);

  const groupedByCustomer = useMemo(() => {
    const groups: Record<string, Incident[]> = {};
    for (const inc of incidents) {
      if (!groups[inc.customer_id]) groups[inc.customer_id] = [];
      groups[inc.customer_id].push(inc);
    }
    return Object.entries(groups).sort((a, b) => {
      const aCrit = a[1].filter(i => i.severity === 'critical').length;
      const bCrit = b[1].filter(i => i.severity === 'critical').length;
      if (bCrit !== aCrit) return bCrit - aCrit;
      return b[1].length - a[1].length;
    });
  }, [incidents]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-[32px] font-bold tracking-[-0.03em] text-white">Incidents</h2>
        <p className="text-[14px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
          AI-detected anomalies with automated root cause analysis
        </p>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-5">
        {[
          { label: 'Total', value: kpiCounts.total, color: 'var(--color-blue)' },
          { label: 'Critical', value: kpiCounts.critical, color: 'var(--color-red)' },
          { label: 'Warning', value: kpiCounts.warning, color: 'var(--color-yellow)' },
          { label: 'Resolved', value: kpiCounts.resolved, color: 'var(--color-green)' },
        ].map((kpi) => (
          <div key={kpi.label} className="stat-card" style={{ '--accent-color': kpi.color } as React.CSSProperties}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {kpi.label}
            </p>
            <p className="text-[28px] font-bold tracking-[-0.02em] leading-none tabular-nums" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Controls Row */}
      <div className="flex items-center justify-between gap-4">
        {/* Status filter */}
        <div className="flex p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
          {(['all', 'open', 'resolved'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`filter-pill ${filter === f ? 'filter-pill-active' : 'filter-pill-inactive'}`}
            >
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex p-0.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)' }}>
          {([
            { id: 'timeline' as ViewMode, label: 'Timeline' },
            { id: 'by-customer' as ViewMode, label: 'By Customer' },
            { id: 'by-severity' as ViewMode, label: 'By Severity' },
          ]).map((mode) => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={`filter-pill ${viewMode === mode.id ? 'filter-pill-active' : 'filter-pill-inactive'}`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }} />
        </div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-20 glass-card-static">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'var(--color-green-dim)' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <p className="text-[18px] font-bold text-white">No incidents</p>
          <p className="text-[14px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
            All systems operating normally
          </p>
        </div>
      ) : viewMode === 'timeline' ? (
        <div className="space-y-4">
          {incidents.map((inc, i) => <IncidentCard key={inc.id} inc={inc} index={i} />)}
        </div>
      ) : viewMode === 'by-severity' ? (
        <div className="space-y-6">
          <SeveritySection label="Critical" color="var(--color-red)" incidents={groupedBySeverity.critical} />
          <SeveritySection label="Warning" color="var(--color-yellow)" incidents={groupedBySeverity.warning} />
          <SeveritySection label="Info" color="var(--color-text-muted)" incidents={groupedBySeverity.info} defaultOpen={false} />
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByCustomer.map(([customerId, customerIncidents]) => (
            <CustomerSection key={customerId} customerId={customerId} incidents={customerIncidents} />
          ))}
        </div>
      )}
    </div>
  );
}
