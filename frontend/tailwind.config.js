/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx}",
    "./src/components/**/*.{js,jsx}",
    "./src/data/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        brand: {
          50: "#eefbfd",
          100: "#d3f3f8",
          400: "#33b8cf",
          500: "#1493ab",
          600: "#0f7488",
          700: "#0c5c6d",
        },
        risk: {
          low: "#2dd4bf",
          moderate: "#f5b942",
          high: "#e2483d",
          severe: "#a3172e",
        },
        ink: {
          900: "#0a0f1a",
          800: "#0f1726",
          700: "#151f33",
          600: "#1e2b45",
          500: "#33456b",
        },
      },
      boxShadow: {
        card: "0 8px 30px rgba(10, 15, 26, 0.08)",
        panel: "0 0 0 1px rgba(255,255,255,0.04), 0 20px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
