/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fffcf8",
        ink: "#1c1916",
        muted: "#6f675f",
        line: "#e4dcd2",
        sand: "#f3efe8",
        copper: "#9a4e32",
        copperSoft: "#f6e7e0",
        good: "#1f6b45",
      },
      boxShadow: {
        card: "0 10px 30px rgba(40, 28, 18, 0.08)",
      },
    },
  },
  plugins: [],
};
