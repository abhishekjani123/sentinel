import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import type { Customer, EventStats, Incident } from '../lib/api';
import HealthScore from './HealthScore';

const tierBadge: Record<string, { bg: string; color: string }> = {
  enterprise: { bg: 'var(--color-purple-dim)', color: 'var(--color-purple)' },
  pro: { bg: 'var(--color-blue-dim)', color: 'var(--color-blue)' },
  free: { bg: 'rgba(255,255,255,0.04)', color: 'var(--color-text-muted)' },
};

export default function Dashboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [c, s, i] = await Promise.all([
        api.getCustomers(),
        api.getEventStats(),
        api.getIncidents({ status: 'open' }),
      ]);
      setCustomers(c);
      setStats(s);
      setIncidents(i);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  const avgHealth = customers.length
    ? customers.reduce((sum, c) => sum + c.health_score, 0) / customers.length
    : 100;

  const kpiStats = [
    { label: 'Health Score', value: avgHealth.toFixed(1), suffix: '%', color: avgHealth >= 80 ? 'var(--color-green)' : avgHealth >= 50 ? 'var(--color-yellow)' : 'var(--color-red)' },
    { label: 'Total Events', value: stats ? stats.total_events.toLocaleString() : '0', suffix: '', color: 'var(--color-blue)' },
    { label: 'Total Errors', value: stats ? stats.total_errors.toLocaleString() : '0', suffix: '', color: 'var(--color-red)' },
    { label: 'Avg Latency', value: stats ? stats.avg_latency_ms.toFixed(0) : '0', suffix: 'ms', color: 'var(--color-yellow)' },
  ];

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-[32px] font-bold tracking-[-0.03em] text-white">Customer Health</h2>
          <p className="text-[14px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
            Real-time monitoring across all customers
          </p>
        </div>
        <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[12px] font-medium"
          style={{
            background: incidents.length > 0 ? 'var(--color-red-dim)' : 'var(--color-green-dim)',
            color: incidents.length > 0 ? 'var(--color-red)' : 'var(--color-green)',
            border: `1px solid ${incidents.length > 0 ? 'rgba(255,80,0,0.2)' : 'rgba(0,200,5,0.2)'}`,
          }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: incidents.length > 0 ? 'var(--color-red)' : 'var(--color-green)' }} />
          {incidents.length > 0 ? `${incidents.length} open incident${incidents.length > 1 ? 's' : ''}` : 'All systems nominal'}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-4 gap-6">
        {kpiStats.map((stat, i) => (
          <div
            key={stat.label}
            className="stat-card"
            style={{ '--accent-color': stat.color, animationDelay: `${i * 60}ms` } as React.CSSProperties}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-4" style={{ color: 'var(--color-text-muted)' }}>
              {stat.label}
            </p>
            <p className="text-[36px] font-bold tracking-[-0.03em] leading-none" style={{ color: stat.color }}>
              {stat.value}
              {stat.suffix && <span className="text-[14px] font-semibold ml-1 opacity-50">{stat.suffix}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Customer Cards */}
      <div>
        <p className="section-title mb-5">Customers</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {customers.map((customer, i) => {
            const tier = tierBadge[customer.tier] || tierBadge.free;
            const isUnhealthy = customer.health_score < 50;
            return (
              <Link
                key={customer.id}
                to={`/customers/${customer.id}`}
                className="glass-card gradient-border p-6 block"
                style={{
                  animationDelay: `${i * 40}ms`,
                  borderColor: isUnhealthy ? 'rgba(255,80,0,0.3)' : undefined,
                }}
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[16px] text-white truncate">{customer.name}</h3>
                    <span className="inline-block mt-2 text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-[0.08em]"
                      style={{ background: tier.bg, color: tier.color }}>
                      {customer.tier}
                    </span>
                  </div>
                  <HealthScore score={customer.health_score} size="md" />
                </div>
                <div className="grid grid-cols-3 gap-5 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
                  {[
                    { label: 'Error Rate', value: `${(customer.error_rate * 100).toFixed(1)}%`, warn: customer.error_rate > 0.05 },
                    { label: 'Latency', value: `${customer.avg_latency.toFixed(0)}ms`, warn: customer.avg_latency > 200 },
                    { label: 'Events', value: customer.total_events.toLocaleString(), warn: false },
                  ].map((m) => (
                    <div key={m.label}>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-text-muted)' }}>
                        {m.label}
                      </p>
                      <p className="text-[15px] font-bold tabular-nums"
                        style={{ color: m.warn ? 'var(--color-red)' : 'var(--color-text-secondary)' }}>
                        {m.value}
                      </p>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Open Incidents */}
      {incidents.length > 0 && (
        <div className="glass-card-static p-7">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--color-red-dim)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
            </div>
            <h3 className="font-bold text-[16px]">Open Incidents</h3>
            <span className="text-[10px] px-2.5 py-1 rounded-md font-semibold tabular-nums"
              style={{ background: 'var(--color-red-dim)', color: 'var(--color-red)', border: '1px solid rgba(255,80,0,0.15)' }}>
              {incidents.length}
            </span>
          </div>
          <div className="space-y-2">
            {incidents.slice(0, 5).map((inc) => (
              <div key={inc.id} className="flex items-center gap-4 p-4 rounded-xl transition-colors table-row-hover"
                style={{ background: 'rgba(255,255,255,0.015)' }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{
                    background: inc.severity === 'critical' ? 'var(--color-red)' : 'var(--color-yellow)',
                    boxShadow: `0 0 8px ${inc.severity === 'critical' ? 'rgba(255,80,0,0.4)' : 'rgba(255,184,0,0.3)'}`,
                  }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate text-white">{inc.title}</p>
                  <p className="text-[12px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    {inc.customer_id} &middot; {new Date(inc.detected_at).toLocaleTimeString()}
                  </p>
                </div>
                <span className="text-[10px] px-3 py-1 rounded-lg font-semibold uppercase tracking-[0.06em]"
                  style={{
                    background: inc.severity === 'critical' ? 'var(--color-red-dim)' : 'var(--color-yellow-dim)',
                    color: inc.severity === 'critical' ? 'var(--color-red)' : 'var(--color-yellow)',
                  }}>
                  {inc.severity}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
