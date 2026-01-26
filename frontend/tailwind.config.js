/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#844392',
          hover: '#6d3678',
          light: 'rgba(132,67,146,0.1)',
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
    },
  },
  plugins: [],
}
