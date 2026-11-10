/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1F3A2E',
          hover: '#172E24',
          light: '#2D5241',
          subtle: '#264638',
        },
        sage: {
          DEFAULT: '#6B7F68',
          light: '#B5BA9B',
          subtle: '#E2E6D8',
          border: '#D3D8C8',
        },
        gold: {
          DEFAULT: '#C4A265',
          light: '#DFCA9F',
          subtle: '#F6EEDB',
        },
        cream: {
          DEFAULT: '#F1EBDD',
          card: '#FBF8F1',
          light: '#F8F5ED',
          border: '#E2DDD1',
          dark: '#E8E1D2',
        },
        ink: {
          DEFAULT: '#1A2B22',
          muted: '#5C6B62',
          light: '#7D8C83',
        },
      },
      fontFamily: {
        serif: ['Newsreader', 'Playfair Display', 'Georgia', 'serif'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        editorial: '0 2px 8px rgba(26, 43, 34, 0.04)',
        card: '0 1px 3px rgba(26, 43, 34, 0.05)',
      },
    },
  },
  plugins: [],
}
