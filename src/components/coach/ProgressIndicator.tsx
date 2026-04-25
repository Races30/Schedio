import { TrendingUp, TrendingDown, Minus, Sparkles } from 'lucide-react';
import { MEASURE_UNIT, MeasureType } from '@/types';

export type ProgressDirection = 'up' | 'down' | 'same' | 'first';

export function getProgressDirection(
  current: number,
  previous: number | null | undefined,
): ProgressDirection {
  if (previous == null) return 'first';
  const diff = current - previous;
  if (Math.abs(diff) < 0.0001) return 'same';
  return diff > 0 ? 'up' : 'down';
}

interface ProgressIndicatorProps {
  current: number | null;
  previous: number | null | undefined;
  measureType?: MeasureType | string;
  showDiff?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function ProgressIndicator({
  current,
  previous,
  measureType,
  showDiff = true,
  size = 'md',
}: ProgressIndicatorProps) {
  if (current == null) return null;

  const direction = getProgressDirection(current, previous);
  const unit = measureType ? (MEASURE_UNIT[measureType as MeasureType] ?? '') : '';

  const iconClass = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const textClass = size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm' : 'text-xs';

  if (direction === 'first') {
    return (
      <span className={`inline-flex items-center gap-1 ${textClass} text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md`}>
        <Sparkles className={iconClass} />
        Primo
      </span>
    );
  }

  const diff = previous != null ? current - previous : 0;
  const sign = diff > 0 ? '+' : '';
  const diffStr = Number.isInteger(diff)
    ? `${sign}${diff}`
    : `${sign}${diff.toFixed(1)}`;

  if (direction === 'up') {
    return (
      <span className={`inline-flex items-center gap-1 text-emerald-500 font-semibold ${textClass}`}>
        <TrendingUp className={iconClass} />
        {showDiff && <span>{diffStr} {unit}</span>}
      </span>
    );
  }

  if (direction === 'down') {
    return (
      <span className={`inline-flex items-center gap-1 text-red-500 font-semibold ${textClass}`}>
        <TrendingDown className={iconClass} />
        {showDiff && <span>{diffStr} {unit}</span>}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 text-muted-foreground ${textClass}`}>
      <Minus className={iconClass} />
      {showDiff && <span className="font-mono">=</span>}
    </span>
  );
}
