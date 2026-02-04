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
        // QQ Coffee brand palette
        brand: {
          DEFAULT: '#6A1A9C',
          hover: '#5B1585',
          light: 'rgba(106,26,156,0.12)',
        },
        'qq-yellow': '#FFEA00',
        'qq-purple': {
          DEFAULT: '#6A1A9C',
          dark: '#4A1068',
          light: '#8B3DB8',
        },
      },
      fontFamily: {
        sans: ['Rubik', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        'button': '30px',
        'card': '16px',
        'input': '12px',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
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
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.5s ease-out forwards',
        'scale-in': 'scale-in 0.35s ease-out forwards',
        'number-count': 'number-count 0.5s ease-out forwards',
      },
    },
  },
  plugins: [],
}
