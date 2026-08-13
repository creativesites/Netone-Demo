import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#dbeafe',
          500: '#0071e3', // Apple blue
          600: '#0077ed',
        },
        ink: {
          900: '#1d1d1f', // Apple near-black
          700: '#3a3a3c',
          500: '#6e6e73', // Apple secondary gray
          400: '#86868b',
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f5f7', // Apple system gray background
        },
        line: '#e5e5e7',
      },
      keyframes: {
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.7' },
          '80%,100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 1.8s cubic-bezier(0.2,0.6,0.35,1) infinite',
        'fade-up': 'fade-up 0.35s ease-out both',
      },
    },
  },
  plugins: [],
};
export default config;
