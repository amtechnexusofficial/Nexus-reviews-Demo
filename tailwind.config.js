/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Whitelabel mechanism — a reseller overrides these CSS vars, nothing
        // else needs to change. Defaults to the Premium Glass purple→pink pair.
        brand: {
          DEFAULT: 'var(--brand-color)',
          hover: 'var(--brand-color-hover)',
          soft: 'var(--brand-color-soft)',
          2: 'var(--brand-color-2)', // gradient partner color
        },
        ink: '#1A1A2E',
        'ink-soft': '#6B6B78',
        paper: '#FAF9FC',
        line: '#E9E4F2',
        success: '#059669',
        warning: '#D97706',
        danger: '#DC2626',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      backgroundImage: {
        'app-gradient': 'linear-gradient(160deg, #F5F3FF 0%, #FDF2F8 50%, #F0F9FF 100%)',
        'brand-gradient': 'linear-gradient(90deg, var(--brand-color), var(--brand-color-2))',
      },
    },
  },
  plugins: [],
};
