import { ButtonHTMLAttributes, forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const base =
  'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed select-none';

const variants: Record<string, string> = {
  primary:
    'bg-gradient-to-r from-brand to-brand-2 text-white shadow-lg shadow-brand/30 hover:shadow-xl hover:shadow-brand/40 active:scale-[0.97]',
  secondary: 'glass text-ink hover:bg-white/80 active:scale-[0.97]',
  ghost: 'bg-transparent text-ink-soft hover:bg-white/50',
  danger: 'bg-danger text-white hover:opacity-90 active:scale-[0.97] shadow-lg shadow-danger/20',
};

const sizes: Record<string, string> = {
  sm: 'text-sm px-4 py-1.5',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-base px-6 py-3.5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, disabled, className = '', children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
