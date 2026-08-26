import type { Config } from "tailwindcss";

// Tokens portados 1:1 desde colors_and_type.css (design system IArcanIA).
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          deep: "#090910",
          dark: "#0f0f1a",
          card: "#13131f",
          "card-2": "#17172a",
        },
        purple: {
          deep: "#7c3aed",
          mid: "#a855f7",
          light: "#c084fc",
        },
        gold: {
          DEFAULT: "#d4af37",
          light: "#f0d060",
          muted: "#b8962e",
          sat: "#daa520",
        },
        text: {
          primary: "#f1f0f7",
          muted: "#9896b0",
          dim: "#5a5870",
        },
        border: {
          DEFAULT: "rgba(168,85,247,0.15)",
          hover: "rgba(168,85,247,0.35)",
          gold: "rgba(212,175,55,0.25)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "16px",
        lg: "24px",
      },
      boxShadow: {
        "glow-purple": "0 0 30px rgba(124,58,237,0.40)",
        "glow-purple-hover": "0 8px 40px rgba(124,58,237,0.55)",
        "glow-gold": "0 4px 24px rgba(212,175,55,0.20)",
      },
      backgroundImage: {
        "gradient-cta": "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
        "gradient-gold": "linear-gradient(135deg, #b8860b 0%, #daa520 100%)",
        "gradient-text": "linear-gradient(135deg, #c084fc 0%, #f0d060 100%)",
        "gradient-sep-purple":
          "linear-gradient(90deg, transparent, #7c3aed, transparent)",
        "gradient-sep-gold":
          "linear-gradient(90deg, transparent, #b8962e, transparent)",
        "gradient-accent": "linear-gradient(90deg, #7c3aed, #d4af37)",
      },
      keyframes: {
        float1: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(30px, 40px)" },
        },
        float2: {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-20px, -30px)" },
        },
        float3: {
          "0%, 100%": { transform: "translate(0, 0) scale(1)" },
          "50%": { transform: "translate(15px, -20px) scale(1.1)" },
        },
        "pulse-gold": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.5", transform: "scale(0.8)" },
        },
      },
      animation: {
        float1: "float1 8s ease-in-out infinite",
        float2: "float2 10s ease-in-out infinite",
        float3: "float3 12s ease-in-out infinite",
        "pulse-gold": "pulse-gold 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
