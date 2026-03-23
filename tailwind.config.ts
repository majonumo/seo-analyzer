import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      colors: {
        // Neutrales dark mode
        zinc: {
          950: '#0A0A0A',
          900: '#111111',
          800: '#1A1A1A',
          700: '#2A2A2A',
        },
        // Score semánticos
        critical: '#EF4444',
        warning:  '#F59E0B',
        success:  '#10B981',
        info:     '#6366F1',
      },
      animation: {
        'score-ring': 'scoreRing 0.7s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        scoreRing: {
          '0%':   { strokeDashoffset: '251.2' },
          '100%': { strokeDashoffset: 'var(--dash-offset)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
