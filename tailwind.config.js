/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        up: '#ef4444',
        down: '#22c55e',
      },
    },
  },
  plugins: [],
}
