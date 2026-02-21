interface HealthScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

function getHealthColor(score: number): string {
  if (score >= 80) return 'var(--color-green)';
  if (score >= 50) return 'var(--color-yellow)';
  return 'var(--color-red)';
}

function getHealthLabel(score: number): string {
  if (score >= 90) return 'Healthy';
  if (score >= 70) return 'Degraded';
  if (score >= 40) return 'At Risk';
  return 'Critical';
}

const sizes = {
  sm: { ring: 36, stroke: 3, font: 'text-[11px]', label: false },
  md: { ring: 52, stroke: 3.5, font: 'text-[13px]', label: true },
  lg: { ring: 76, stroke: 4, font: 'text-lg', label: true },
};

export default function HealthScore({ score, size = 'md' }: HealthScoreProps) {
  const cfg = sizes[size];
  const radius = (cfg.ring - cfg.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getHealthColor(score);

  return (
    <div className="flex flex-col items-center gap-0.5 relative">
      <div className="relative">
        <svg width={cfg.ring} height={cfg.ring} className="-rotate-90">
          <circle
            cx={cfg.ring / 2}
            cy={cfg.ring / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={cfg.stroke}
          />
          <circle
            cx={cfg.ring / 2}
            cy={cfg.ring / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={cfg.stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
              filter: `drop-shadow(0 0 4px ${color}66)`,
            }}
          />
        </svg>
        <span
          className={`${cfg.font} font-bold absolute inset-0 flex items-center justify-center`}
          style={{ color }}
        >
          {score.toFixed(0)}
        </span>
      </div>
      {cfg.label && (
        <span className="text-[10px] font-medium mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
          {getHealthLabel(score)}
        </span>
      )}
    </div>
  );
}
