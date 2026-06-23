/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "var(--bg-app)",
        panel: "var(--bg-panel)",
        header: "var(--bg-header)",
        sidebar: "var(--bg-sidebar)",
        borderLight: "var(--border-light)",
        borderMain: "var(--border-main)",
        borderDark: "var(--border-dark)",
        textMain: "var(--text-main)",
        textMuted: "var(--text-muted)",
        textInverse: "var(--text-inverse)",
        selpanel: "var(--bg-selpanel)",
        primary: {
          DEFAULT: "var(--primary)",
          light: "var(--primary-light)",
          dark: "var(--primary-dark)",
        },
        success: {
          DEFAULT: "var(--success)",
          light: "var(--success-light)",
          dark: "var(--success-dark)",
        },
        danger: {
          DEFAULT: "var(--danger)",
          light: "var(--danger-light)",
          dark: "var(--danger-dark)",
        },
        warning: {
          DEFAULT: "var(--warning)",
          light: "var(--warning-light)",
          dark: "var(--warning-dark)",
        },
        info: {
          DEFAULT: "var(--info)",
          light: "var(--info-light)",
          dark: "var(--info-dark)",
        },
      },
    },
  },
  plugins: [],
};
