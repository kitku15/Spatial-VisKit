/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        customGray: '#d3d3d3',
        customDark: '#6b7280',
      }
    },
  },
  plugins: [],
}