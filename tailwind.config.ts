import type { Config } from "tailwindcss";

// Tokens portados 1:1 desde os.css (el dashboard operativo real que se usaba
// a diario) — NO desde colors_and_type.css (ese es el sitio de marketing
// público, un sistema visual distinto y más vistoso a propósito). Ver
// NOTES.md "Sistema de diseño" para la comparación completa.
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
          deep: "#080808", // os.css --bg
          dark: "#0c0c0c", // sidebar
          card: "#111111", // os.css --bg-card
          "card-2": "#161616", // nav-item.active / freq-tab.active
          hover: "#181818", // os.css --bg-hover
        },
        // Único color de acción real en os.css (botones primarios, foco de
        // inputs, modal de login) — no es un sistema de 3 tonos con
        // gradientes, es un morado plano.
        purple: {
          deep: "#7c3aed",
          mid: "#9b72f0", // os.css --purple / .btn-save / .btn-primary
          light: "#ad8af5", // hover de .btn-primary
        },
        gold: {
          DEFAULT: "#c4a35a", // os.css --gold
          light: "#c4a35a",
          muted: "#c4a35a",
          sat: "#c4a35a",
        },
        text: {
          primary: "#e8e0d0", // os.css --text
          // Mapeo por PESO VISUAL, no por nombre — os.css nombra sus dos
          // tonos de gris al revés de lo intuitivo: --text-dim (#8A8070) es
          // MÁS visible que --text-muted (#4A4440). Aquí "muted" sigue
          // siendo el tono medio (como se usa en todo el código ya escrito)
          // y "dim" el más apagado, para no invertir la jerarquía visual.
          muted: "#8a8070", // os.css --text-dim
          dim: "#4a4440", // os.css --text-muted
        },
        border: {
          DEFAULT: "#1e1e1e", // os.css --border — gris plano, NO morado
          hover: "#2a2a2a", // hover genérico (task-item, book-card, script-card)
          gold: "rgba(196,163,90,0.2)", // os.css --border-gold
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
      },
      // "Gradientes" planos (mismo color repetido) y sombras neutralizadas a
      // propósito — muchas páginas ya escritas usan bg-gradient-cta/
      // shadow-glow-purple para el botón primario; en vez de editar cada
      // archivo, se redefine qué significan esas clases para que calcen con
      // el botón plano real de os.css (.btn-save: #9b72f0 sin sombra), sin
      // reintroducir el look de gradiente/glow del sitio de marketing.
      backgroundImage: {
        "gradient-cta": "linear-gradient(0deg, #9b72f0, #9b72f0)",
        "gradient-text": "linear-gradient(0deg, #e8e0d0, #e8e0d0)",
      },
      boxShadow: {
        "glow-purple": "none",
        "glow-purple-hover": "none",
      },
    },
  },
  plugins: [],
};

export default config;
