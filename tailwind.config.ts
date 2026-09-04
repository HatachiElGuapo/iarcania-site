import type { Config } from "tailwindcss";

// Tokens del sistema visual "Sistema IArcanIA" (rebranding, turnos 4a/5a).
// Ver docs/sistema-de-diseno.md para el porqué de cada uno.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "#0F0F11", //           fondo de la app
        surface: "#16161A", //          cards y paneles
        "surface-2": "#1C1C21", //      header de card, hover, modal
        "surface-sunken": "#131316", // sidebar, barras de captura
        "surface-active": "#161616", // fondo del item activo del sidebar
        line: "#262629", //             borde por defecto
        "line-strong": "#33333A", //    hover y bordes de modal
        ink: "#F1F0F7", //              títulos y valores
        "ink-muted": "#9896B0", //      cuerpo y descripciones
        "ink-dim": "#5A5870", //        metadatos y labels
        accent: "#8B5CF6", //           acción primaria, item activo
        "accent-soft": "rgba(139,92,246,0.12)", // fondo hover de acción primaria
        "accent-text": "#C4B5FD", //    violeta legible para texto pequeño sobre oscuro (chip accent, estado "enviando")
        "accent-warm": "#E8A33D", //    nav activo, «ahora», hábitos, categoría infra
        success: "#4ADE80", //          completado, racha viva
        danger: "#F87171", //           vencido, eliminar
        // Colores de categoría — reflejan lib/constants/cats.ts (fuente
        // única). `none` es el fallback para categoría nula/desconocida.
        category: {
          iarcania: "#E24B4A",
          contenido: "#378ADD",
          proyectos: "#8B6CF6",
          personal: "#5DCAA5",
          infra: "#EF9F27",
          habitos: "#E8A33D", // = accent-warm (antes #9896b0, chocaba con ink-muted)
          none: "#3A3A42",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "ui-sm": "5px", // inputs pequeños
        ui: "6px", //     botones, inputs, chips cuadrados
        "ui-lg": "10px", // cards y paneles
      },
      // Transición del sistema: solo colors y opacity, 120 ms (ver 4a).
      transitionDuration: {
        "120": "120ms",
      },
      // Escala +1 de 5f, aplicada a cuerpo y metadatos (labels, badges y
      // títulos se dejan como están). Un solo lugar para el ajuste de
      // densidad (5f · densidadFilas).
      fontSize: {
        body: "13.5px", // fila de tabla, item de lista, valor de campo, input
        meta: "11.5px", // fechas, contadores, anotaciones secundarias
      },
    },
  },
  plugins: [],
};

export default config;
