/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          base:     'rgb(var(--t-bg-base)    / <alpha-value>)',
          surface:  'rgb(var(--t-bg-surface) / <alpha-value>)',
          elevated: 'rgb(var(--t-bg-elevated)/ <alpha-value>)',
          overlay:  'rgba(0,0,0,0.7)',
        },
        brand: {
          primary:   'rgb(var(--t-accent)  / <alpha-value>)',
          secondary: 'rgb(var(--t-accent2) / <alpha-value>)',
          accent:    'rgb(var(--t-accent3) / <alpha-value>)',
          glow:      'rgb(var(--t-accent)  / 0.30)',
        },
        border: {
          DEFAULT: 'rgb(var(--t-border) / 0.08)',
          focus:   'rgb(var(--t-accent) / 0.60)',
          hover:   'rgb(var(--t-border) / 0.15)',
        },
        text: {
          primary:   'rgb(var(--t-text-primary)   / <alpha-value>)',
          secondary: 'rgb(var(--t-text-secondary) / <alpha-value>)',
          muted:     'rgb(var(--t-text-muted)     / <alpha-value>)',
          accent:    'rgb(var(--t-text-accent)    / <alpha-value>)',
        },
        status: {
          success: '#10b981',
          warning: '#f59e0b',
          danger:  '#ef4444',
          info:    '#3b82f6',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-brand': 'linear-gradient(135deg, rgb(var(--t-accent)), rgb(var(--t-accent2)))',
        'gradient-blue': 'linear-gradient(135deg, rgb(var(--t-accent3)), rgb(var(--t-accent)))',
        'gradient-danger': 'linear-gradient(135deg, #ef4444, #ec4899)',
        'gradient-success': 'linear-gradient(135deg, #10b981, #3b82f6)'
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        'glow-sm': '0 0 12px rgb(var(--t-accent) / 0.25)',
        'glow-md': '0 0 24px rgb(var(--t-accent) / 0.35)',
        'glow-lg': '0 0 48px rgb(var(--t-accent) / 0.40)',
        'glow-blue': '0 0 20px rgb(var(--t-accent3) / 0.40)',
        'card': '0 4px 16px rgba(0,0,0,0.3)',
      },
      backdropBlur: {
        xs: '4px',
        sm: '8px',
        DEFAULT: '16px',
        lg: '24px',
        xl: '40px',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'shimmer': 'shimmer 2s infinite',
        'scan-line': 'scanLine 2s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        scanLine: {
          '0%': { top: '0%', opacity: '1' },
          '100%': { top: '100%', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
