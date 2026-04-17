import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: '#0A0612',
          soft: '#141024',
          card: '#141024',
          elevated: '#1C1635',
        },
        surface: {
          2: '#241B42',
          3: '#2D2152',
        },
        neon: {
          cyan: '#22D3EE',
          magenta: '#EC4899',
          violet: '#A855F7',
          lime: '#A3E635',
          amber: '#FBBF24',
          rose: '#F43F5E',
          orange: '#F97316',
        },
        border: {
          DEFAULT: '#2A2148',
          strong: '#3D2D6B',
          bright: '#3D2D6B',
        },
        text: {
          DEFAULT: '#F4F0FF',
          muted: '#A09AC0',
          dim: '#6E6A8C',
        },
      },
      boxShadow: {
        'glow-cyan': '0 0 0 1px rgba(34,211,238,0.6), 0 0 28px rgba(34,211,238,0.25)',
        'glow-magenta': '0 0 0 1px rgba(236,72,153,0.6), 0 0 28px rgba(236,72,153,0.3)',
        'glow-violet': '0 0 0 1px rgba(168,85,247,0.6), 0 0 28px rgba(168,85,247,0.3)',
        'glow-lime': '0 0 0 1px rgba(163,230,53,0.55), 0 0 28px rgba(163,230,53,0.28)',
        'glow-amber': '0 0 0 1px rgba(251,191,36,0.5), 0 0 28px rgba(251,191,36,0.25)',
        card: '0 10px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'Inter', 'ui-sans-serif', 'system-ui'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'pulse-neon': {
          '0%,100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'grid-drift': {
          '0%': { transform: 'perspective(900px) rotateX(55deg) translateY(0) scale(1.4)' },
          '100%': { transform: 'perspective(900px) rotateX(55deg) translateY(56px) scale(1.4)' },
        },
        'blob-float': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '33%': { transform: 'translate(60px,-40px) scale(1.1)' },
          '66%': { transform: 'translate(-40px,50px) scale(0.95)' },
        },
        'timer-shake': {
          '0%,100%': { transform: 'translate(0,0)' },
          '25%': { transform: 'translate(-2px,1px)' },
          '75%': { transform: 'translate(2px,-1px)' },
        },
      },
      animation: {
        'pulse-neon': 'pulse-neon 1.6s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
        'float-in': 'float-in 0.3s ease-out',
        'grid-drift': 'grid-drift 22s linear infinite',
        'blob-float': 'blob-float 18s ease-in-out infinite',
        'timer-shake': 'timer-shake 0.25s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
export default config;
