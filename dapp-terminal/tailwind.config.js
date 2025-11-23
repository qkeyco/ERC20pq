/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'vt323': ['VT323', 'monospace'],
        'terminal': ['VT323', 'Courier New', 'monospace'],
      },
      colors: {
        'terminal-green': '#00ff00',
        'terminal-bg': '#000000',
        'terminal-dark': '#001a00',
        'terminal-glow': '#00ff00',
        'monitor-bezel': '#cccccc',
        'monitor-glow': '#ffcc00',
      },
      textShadow: {
        'terminal': '0 0 5px #00ff00',
        'glow': '0 0 10px #00ff00',
      },
    },
  },
  plugins: [],
}
