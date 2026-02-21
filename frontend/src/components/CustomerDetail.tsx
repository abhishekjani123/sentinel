import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { api } from '../lib/api';
import type { Customer, EventData, MetricBucket, Incident } from '../lib/api';
import HealthScore from './HealthScore';

const severityColors: Record<string, string> = {
  info: '#71717a',
  warning: '#FFB800',
  error: '#FF5000',
  critical: '#ef4444',
};

const tooltipStyle = {
  background: 'rgba(0,0,0,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 12,
  color: '#fff',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  fontSize: 12,
};

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [events, setEvents] = useState<EventData[]>([]);
  const [metrics, setMetrics] = useState<MetricBucket[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [c, e, m, i] = await Promise.all([
        api.getCustomer(id),
        api.getCustomerEvents(id, 50),
        api.getCustomerMetrics(id),
        api.getIncidents({ customer_id: id }),
      ]);
      setCustomer(c);
      setEvents(e);
      setMetrics(m);
      setIncidents(i);
    } catch (e) {
      console.error('Failed to fetch customer data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [id]);

  if (loading || !customer) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</span>
        </div>
      </div>
    );
  }

  const chartData = metrics.map((m) => ({
    time: m.bucket ? m.bucket.split('T')[1]?.slice(0, 5) : '',
    latency: m.avg_latency,
    errorRate: +(m.error_rate * 100).toFixed(1),
    requests: m.request_count,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-[13px]">
        <Link to="/" className="transition-colors hover:text-white" style={{ color: 'var(--color-text-muted)' }}>Dashboard</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--color-text-muted)' }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span className="text-white font-medium">{customer.name}</span>
      </div>

      {/* Header Card */}
      <div className="glass-card-static p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[24px] font-bold tracking-[-0.02em] text-white">{customer.name}</h2>
            <div className="flex items-center gap-2.5 mt-2">
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-medium uppercase tracking-wide"
                style={{ background: 'var(--color-purple-dim)', color: 'var(--color-purple)' }}>
                {customer.tier}
              </span>
              {customer.open_incidents && customer.open_incidents > 0 && (
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-medium"
                  style={{ background: 'var(--color-red-dim)', color: 'var(--color-red)' }}>
                  {customer.open_incidents} open incident{customer.open_incidents > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
          <HealthScore score={customer.health_score} size="lg" />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Error Rate', value: `${(customer.error_rate * 100).toFixed(1)}%`, color: customer.error_rate > 0.05 ? 'var(--color-red)' : 'var(--color-green)' },
          { label: 'Avg Latency', value: `${customer.avg_latency.toFixed(0)}ms`, color: customer.avg_latency > 200 ? 'var(--color-yellow)' : 'var(--color-green)' },
          { label: 'Total Events', value: customer.total_events.toLocaleString(), color: 'var(--color-blue)' },
          { label: 'Health Score', value: customer.health_score.toFixed(1), color: customer.health_score >= 80 ? 'var(--color-green)' : customer.health_score >= 50 ? 'var(--color-yellow)' : 'var(--color-red)' },
        ].map((stat) => (
          <div key={stat.label} className="stat-card">
            <p className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</p>
            <p className="text-[24px] font-bold tracking-[-0.02em] leading-none" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-card-static p-5">
            <h3 className="text-[13px] font-semibold mb-4 text-white">Latency</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B7FFF" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#5B7FFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="latency" stroke="#5B7FFF" fill="url(#latGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card-static p-5">
            <h3 className="text-[13px] font-semibold mb-4 text-white">Error Rate</h3>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF5000" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#FF5000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#71717a', fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip contentStyle={tooltipStyle} />
                <Area type="monotone" dataKey="errorRate" stroke="#FF5000" fill="url(#errGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Incidents */}
      {incidents.length > 0 && (
        <div className="glass-card-static p-5">
          <h3 className="text-[13px] font-semibold mb-4 text-white">Incidents</h3>
          <div className="space-y-3">
            {incidents.map((inc) => (
              <div key={inc.id} className="p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--color-border)' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: severityColors[inc.severity] || '#71717a' }} />
                    <span className="text-[13px] font-medium text-white">{inc.title}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase"
                    style={{
                      background: inc.status === 'open' ? 'var(--color-red-dim)' : 'var(--color-green-dim)',
                      color: inc.status === 'open' ? 'var(--color-red)' : 'var(--color-green)',
                    }}>
                    {inc.status}
                  </span>
                </div>
                {inc.ai_summary && (
                  <p className="text-[12px] mb-1 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                    <span className="font-semibold" style={{ color: 'var(--color-blue)' }}>AI: </span>{inc.ai_summary}
                  </p>
                )}
                {inc.root_cause && (
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                    <span className="font-semibold" style={{ color: 'var(--color-yellow)' }}>Cause: </span>{inc.root_cause}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Events Table */}
      <div className="glass-card-static overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
          <h3 className="text-[13px] font-semibold text-white">Recent Events</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                {['Time', 'Service', 'Type', 'Severity', 'Latency', 'Status', 'Message'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-medium uppercase tracking-wider"
                    style={{ color: 'var(--color-text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.slice(0, 20).map((ev) => (
                <tr key={ev.id} className="border-t table-row-hover" style={{ borderColor: 'var(--color-border)' }}>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '-'}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-white">{ev.service}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--color-text-secondary)' }}>{ev.event_type}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: `${severityColors[ev.severity]}15`, color: severityColors[ev.severity] }}>
                      {ev.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{ev.latency_ms?.toFixed(0) ?? '-'}ms</td>
                  <td className="px-4 py-2.5 font-mono" style={{ color: 'var(--color-text-secondary)' }}>{ev.status_code ?? '-'}</td>
                  <td className="px-4 py-2.5 truncate max-w-[220px]" style={{ color: 'var(--color-text-muted)' }}>{ev.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
