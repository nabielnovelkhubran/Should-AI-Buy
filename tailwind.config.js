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
        background: '#090b10',
        card: '#11141d',
        cardBorder: '#1e2433',
        accent: '#6366f1',
        bullish: '#10b981',
        bearish: '#ef4444',
        warning: '#f59e0b',
        neutral: '#94a3b8',
        redteam: '#f43f5e'
      },
      animation: {
        'pulse-subtle': 'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
};
