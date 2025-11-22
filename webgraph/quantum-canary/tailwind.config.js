/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'vt323': ['VT323', 'monospace'],
      },
      colors: {
        'terminal-green': '#00ff00',
        'terminal-bg': '#000000',
      },
    },
  },
  plugins: [],
}
