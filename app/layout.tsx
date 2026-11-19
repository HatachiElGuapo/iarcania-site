import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// next/font/local en vez de next/font/google: el build en el servidor
// (Docker) no tiene salida a fonts.googleapis.com y next/font/google
// falla ahí con "Cannot read properties of null" al no poder descargar
// las fuentes. Los .woff2 (mismas fuentes/pesos) viven en app/fonts/,
// copiados una sola vez de los paquetes @fontsource/playfair-display y
// @fontsource/outfit — no se agregan como dependencia de runtime, son
// solo la fuente de los archivos.
const playfairDisplay = localFont({
  src: [
    // 400 = reloj/timer/contador de Reloj + inicial de avatar en Clientes
    // (font-display sin font-bold); 700 = títulos y stats. El 600 no se usa.
    { path: "./fonts/playfair-display/playfair-display-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/playfair-display/playfair-display-latin-700-normal.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-display",
});

// El cuerpo va en Outfit, no Inter — el dashboard original (os.css, ya
// retirado) lo usaba y el sistema nuevo lo mantiene. Ver
// docs/sistema-de-diseno.md · Tipografía.
const outfit = localFont({
  src: [
    { path: "./fonts/outfit/outfit-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/outfit/outfit-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/outfit/outfit-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "./fonts/outfit/outfit-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-body",
});

// PWA: manifest + íconos (public/icons/, generados de el ojo arcano de
// assets/logo.svg — ver public/icons/icon-source.svg) para que "Agregar a
// inicio" dé un ícono y una ventana sin barra de navegador, tanto en iOS
// (que no exige HTTPS para esto) como en Android (que sí, además del
// manifest — ver docs/mobile-pwa.md para el resto de los requisitos).
export const metadata: Metadata = {
  title: "IArcanIA",
  description: "Automatización con IA para PYMEs colombianas",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "IArcanIA",
  },
};

// NO fijar maximumScale/userScalable acá — se probó dos veces (iOS y
// Android) y las dos veces terminó atrapando al usuario en el zoom que
// el navegador ya tenía guardado para el sitio, sin forma de volver atrás
// a mano. El zoom pegado al entrar es el navegador recordando un nivel de
// zoom por sitio (se corrige desde la configuración del navegador/PWA
// instalada, no desde acá — ver docs/mobile-pwa.md), no algo que el
// viewport de la página deba (o pueda, en Chrome/Android) forzar.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0F0F11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${playfairDisplay.variable} ${outfit.variable}`}>
      <body>{children}</body>
    </html>
  );
}
