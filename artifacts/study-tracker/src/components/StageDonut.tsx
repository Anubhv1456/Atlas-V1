import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface StageDonutProps {
  label: string;
  pct: number;      // 0–100
  color: string;    // hex stroke color
  active: boolean;
  onClick: () => void;
}

const SIZE = 68;
const STROKE = 4.5;
const R = (SIZE / 2) - (STROKE / 2) - 1;
const CIRC = 2 * Math.PI * R;

export function StageDonut({ label, pct, color, active, onClick }: StageDonutProps) {
  const [animatedPct, setAnimatedPct] = useState(0);

  // Animate in on mount and whenever pct changes
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimatedPct(pct));
    return () => cancelAnimationFrame(id);
  }, [pct]);

  const offset = CIRC - (CIRC * animatedPct) / 100;

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 py-2 px-2 rounded-2xl transition-all duration-200 select-none',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
        active ? 'bg-muted/80' : 'hover:bg-muted/40 active:bg-muted/60',
      )}
      aria-label={`${label}: ${Math.round(pct)}%${active ? ' – filter active' : ''}`}
    >
      {/* Ring */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          {/* Track — same color at low opacity, looks right in light + dark */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            opacity={0.15}
          />
          {/* Progress arc */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[12px] font-bold leading-none tabular-nums" style={{ color }}>
            {Math.round(pct)}%
          </span>
        </div>
      </div>

      {/* Stage label */}
      <span className="text-[11px] font-medium text-muted-foreground leading-none">
        {label}
      </span>

      {/* Active dot */}
      {active && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: color }} />}
    </button>
  );
}
