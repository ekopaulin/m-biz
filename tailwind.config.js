/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#7AF8D0',
          dark: '#5BD5B0',
        },
        brandOrange: '#E8650A',
        bg: {
          main: '#EBEDF0',
          light: '#F0FAFE',
          card: '#FFFFFF'
        },
        text: {
          main: '#000000',
          muted: '#767C8C'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(122, 248, 208, 0.2)',
      }
    },
  },
  plugins: [],
}
