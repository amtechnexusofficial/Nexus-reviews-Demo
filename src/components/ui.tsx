import { HTMLAttributes, ReactNode } from 'react';
import { Star } from 'lucide-react';

export function Card({ children, className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`glass rounded-3xl p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'brand';
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-white/70 text-ink-soft border-white/80',
    success: 'bg-gradient-to-r from-emerald-500/10 to-green-500/10 text-success border-transparent',
    warning: 'bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-warning border-transparent',
    danger: 'bg-gradient-to-r from-red-500/10 to-rose-500/10 text-danger border-transparent',
    brand: 'bg-gradient-to-r from-brand/15 to-brand-2/15 text-brand border-transparent',
  };
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function StarRating({
  value,
  onChange,
  size = 32,
  readOnly = false,
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1" role={readOnly ? undefined : 'radiogroup'} aria-label="Star rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={n <= value}
          onClick={() => onChange?.(n)}
          className={readOnly ? 'cursor-default' : 'cursor-pointer'}
          style={{ width: size, height: size }}
        >
          <Star
            className="w-full h-full transition-colors"
            fill={n <= value ? '#F59E0B' : 'transparent'}
            stroke={n <= value ? '#F59E0B' : '#E9E4F2'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6">
      <p className="font-display font-semibold text-lg text-ink mb-1">{title}</p>
      <p className="text-sm text-ink-soft max-w-sm mx-auto mb-4">{body}</p>
      {action}
    </div>
  );
}
