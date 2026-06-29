import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: "#393836",
        copper: "#c9612e",
        "copper-light": "#d9784a",
        cream: "#f7f3ee",
        "cream-dark": "#ede6db",
        "text-muted": "#8a8480",
        border: "#e4ddd4",
      },
      fontFamily: {
        sans: ["Nunito Sans", "Proxima Nova", "-apple-system", "sans-serif"],
        serif: ["Playfair Display", "Optima", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
