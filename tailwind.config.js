/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Legacy (kept for backward compat)
        background: '#121117',
        card: '#1f1e23',
        cardBorder: '#28272e',
        accent: '#6366f1',
        bullish: '#10b981',
        bearish: '#ef4444',
        warning: '#f59e0b',
        neutral: '#94a3b8',
        redteam: '#f43f5e',
        // Phantom Terminal Design System
        brand: '#00ff84',
        sell: '#ff3b5c',
        terminal: {
          base: '#121117',
          panel: '#1f1e23',
          card: '#1f1e23',
          hover: '#2a2930',
          border: '#28272e',
          borderBright: '#34333b',
        },
        slate: {
          800: '#28272e',
          900: '#1f1e23',
          950: '#1f1e23',
        }
      },
      fontFamily: {
        sans: ['Phantom', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'Segoe UI', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        phantom: ['Phantom', 'sans-serif'],
        cash: ['PhantomCash', 'JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'brand-pulse': 'brandPulse 2s ease-in-out infinite',
      },
      keyframes: {
        brandPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        }
      }
    },
  },
  plugins: [],
};
