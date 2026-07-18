/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0A0A0A',
        void: '#111111',
        neon: '#00FF41',
        blood: '#FF003C',
        steel: '#4A4A4A'
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Roboto Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
