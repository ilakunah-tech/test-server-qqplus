/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // QQ Coffee brand — огонь и кофе (основные акценты)
        brand: {
          DEFAULT: '#E85D04',
          hover: '#D45103',
          light: 'rgba(232, 93, 4, 0.15)',
        },
        'qq-yellow': '#FFEA00',
        'qq-flame': {
          DEFAULT: '#F48C06',
          light: '#FFB627',
          dark: '#E85D04',
        },
        'qq-orange': '#E85D04',
        'qq-amber': '#FFB627',
        'qq-coffee': {
          DEFAULT: '#5D4037',
          light: '#8D6E63',
          dark: '#3E2723',
        },
        'qq-purple': {
          DEFAULT: '#6A1A9C',
          dark: '#4A1068',
          light: '#8B3DB8',
        },
        'qq-destructive': {
          DEFAULT: '#DC2626',
          hover: '#B91C1C',
          light: 'rgba(220, 38, 38, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Rubik', 'Arial', 'sans-serif'],
        tagline: ['Caveat', 'cursive'],
      },
      backgroundImage: {
        'qq-flame-gradient': 'linear-gradient(135deg, #FFEA00 0%, #FFB627 30%, #E85D04 60%, #DC2626 100%)',
        'qq-flame-soft': 'linear-gradient(180deg, rgba(255,234,0,0.08) 0%, rgba(232,93,4,0.05) 100%)',
        'qq-card-light': 'linear-gradient(180deg, #ffffff 0%, #fffbf7 100%)',
        'qq-card-dark': 'linear-gradient(180deg, #1f2937 0%, #111827 100%)',
        'qq-premium-light': 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(255, 251, 247, 0.9) 100%)',
        'qq-premium-dark': 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.9) 100%)',
        'qq-mesh': 'radial-gradient(at 40% 20%, rgba(255, 234, 0, 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(232, 93, 4, 0.06) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(106, 26, 156, 0.04) 0px, transparent 50%)',
      },
      boxShadow: {
        'qq-glow': '0 0 20px rgba(255, 234, 0, 0.25)',
        'qq-glow-dark': '0 0 24px rgba(255, 234, 0, 0.2), 0 0 48px rgba(248, 140, 6, 0.1)',
        'qq-card': '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(232,93,4,0.04)',
        'qq-card-dark': '0 2px 12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,234,0,0.08)',
        'qq-premium': '0 4px 20px rgba(0, 0, 0, 0.05), 0 8px 32px rgba(232, 93, 4, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
        'qq-premium-dark': '0 4px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 234, 0, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
        'qq-premium-hover': '0 12px 40px rgba(0, 0, 0, 0.08), 0 16px 56px rgba(232, 93, 4, 0.08)',
        'qq-premium-hover-dark': '0 12px 40px rgba(0, 0, 0, 0.4), 0 0 40px rgba(255, 234, 0, 0.08)',
      },
      borderRadius: {
        'button': '12px',
        'card': '20px',
        'input': '12px',
        'premium': '24px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'number-count': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.9)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-left': {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'bounce-subtle': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        'wiggle': {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(232, 93, 4, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(232, 93, 4, 0.5), 0 0 60px rgba(255, 182, 39, 0.2)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scale-in 0.35s ease-out forwards',
        'number-count': 'number-count 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-left': 'slide-in-left 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slide-in-right 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'bounce-subtle': 'bounce-subtle 2s ease-in-out infinite',
        'wiggle': 'wiggle 0.5s ease-in-out',
        'glow-pulse': 'glow-pulse 3s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
