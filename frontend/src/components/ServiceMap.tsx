import { useEffect, useState, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { api } from '../lib/api';
import type { ServiceNode as ServiceData } from '../lib/api';
import HealthScore from './HealthScore';

function getNodeColor(score: number): string {
  if (score >= 80) return '#00C805';
  if (score >= 50) return '#FFB800';
  return '#FF5000';
}

function getStatusLabel(score: number): string {
  if (score >= 80) return 'Healthy';
  if (score >= 50) return 'Degraded';
  return 'Critical';
}

function ServiceNodeComponent({ data }: { data: { label: string; score: number } }) {
  const color = getNodeColor(data.score);
  return (
    <div className="px-5 py-3.5 rounded-2xl min-w-[150px] text-center"
      style={{
        background: 'rgba(10,10,10,0.95)',
        border: `1.5px solid ${color}44`,
        boxShadow: `0 0 24px ${color}15, 0 4px 16px rgba(0,0,0,0.3)`,
        backdropFilter: 'blur(12px)',
      }}>
      <Handle type="target" position={Position.Top} style={{ background: color, width: 6, height: 6, border: 'none' }} />
      <p className="text-[13px] font-semibold text-white">{data.label}</p>
      <p className="text-[12px] mt-1 font-mono font-bold" style={{ color }}>
        {data.score.toFixed(0)}%
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6, border: 'none' }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  service: ServiceNodeComponent,
};

const POSITIONS: Record<string, { x: number; y: number }> = {
  'api-gateway': { x: 300, y: 0 },
  'auth-service': { x: 80, y: 160 },
  'user-service': { x: 300, y: 160 },
  'payment-service': { x: 520, y: 160 },
  'database': { x: 300, y: 340 },
  'cache': { x: 80, y: 340 },
};

const chartTooltipStyle = {
  background: 'rgba(0,0,0,0.9)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 10,
  color: '#fff',
  fontSize: 12,
};

export default function ServiceMap() {
  const [services, setServices] = useState<ServiceData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const data = await api.getServices();
      setServices(data);
    } catch (e) {
      console.error('Failed to fetch services:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const nodes: Node[] = services.map((svc) => ({
    id: svc.id,
    type: 'service',
    position: POSITIONS[svc.id] || { x: Math.random() * 400, y: Math.random() * 300 },
    data: { label: svc.name, score: svc.health_score },
  }));

  const edges: Edge[] = services.flatMap((svc) =>
    (svc.dependencies || []).map((dep) => ({
      id: `${svc.id}->${dep}`,
      source: svc.id,
      target: dep,
      animated: true,
      style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1.5 },
    }))
  );

  const chartData = services
    .map(svc => ({
      name: svc.name,
      health: svc.health_score,
      color: getNodeColor(svc.health_score),
    }))
    .sort((a, b) => a.health - b.health);

  const avgHealth = services.length
    ? services.reduce((s, svc) => s + svc.health_score, 0) / services.length
    : 100;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--color-green)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="text-[32px] font-bold tracking-[-0.03em] text-white">Services</h2>
        <p className="text-[14px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Dependency map, health comparison, and status overview
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-3 gap-5">
        <div className="stat-card" style={{ '--accent-color': getNodeColor(avgHealth) } as React.CSSProperties}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--color-text-muted)' }}>Avg Health</p>
          <p className="text-[28px] font-bold tracking-[-0.02em] leading-none" style={{ color: getNodeColor(avgHealth) }}>
            {avgHealth.toFixed(1)}%
          </p>
        </div>
        <div className="stat-card" style={{ '--accent-color': 'var(--color-blue)' } as React.CSSProperties}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--color-text-muted)' }}>Total Services</p>
          <p className="text-[28px] font-bold tracking-[-0.02em] leading-none" style={{ color: 'var(--color-blue)' }}>
            {services.length}
          </p>
        </div>
        <div className="stat-card" style={{ '--accent-color': 'var(--color-red)' } as React.CSSProperties}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--color-text-muted)' }}>Degraded</p>
          <p className="text-[28px] font-bold tracking-[-0.02em] leading-none" style={{ color: 'var(--color-red)' }}>
            {services.filter(s => s.health_score < 80).length}
          </p>
        </div>
      </div>

      {/* Dependency Map */}
      <div>
        <p className="section-title mb-4">Dependency Map</p>
        <div className="glass-card-static overflow-hidden" style={{ height: 550 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: '#000' }}
          >
            <Background color="rgba(255,255,255,0.015)" gap={24} size={1} />
            <Controls
              style={{
                background: 'rgba(10,10,10,0.9)',
                borderColor: 'rgba(255,255,255,0.06)',
                borderRadius: 12,
                overflow: 'hidden',
              }}
            />
          </ReactFlow>
        </div>
      </div>

      {/* Health Comparison Chart */}
      <div>
        <p className="section-title mb-4">Health Comparison</p>
        <div className="glass-card-static p-6">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fill: '#a1a1aa', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Health']} />
              <Bar dataKey="health" radius={[0, 6, 6, 0]} barSize={20}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Service Cards */}
      <div>
        <p className="section-title mb-4">Service Details</p>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-5">
          {services.map((svc) => {
            const color = getNodeColor(svc.health_score);
            const statusLabel = getStatusLabel(svc.health_score);
            return (
              <div
                key={svc.id}
                className="glass-card card-accent-left p-5 flex items-center gap-4"
                style={{ '--accent-color': color } as React.CSSProperties}
              >
                <HealthScore score={svc.health_score} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-white truncate">{svc.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[11px] font-medium" style={{ color }}>
                      {statusLabel}
                    </span>
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {svc.dependencies.length} dep{svc.dependencies.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <span className="text-[20px] font-bold font-mono tabular-nums" style={{ color }}>
                  {svc.health_score.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
