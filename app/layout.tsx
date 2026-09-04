import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  // 400 = reloj/timer/contador de Reloj + inicial de avatar en Clientes
  // (font-display sin font-bold); 700 = títulos y stats. El 600 no se usa.
  weight: ["400", "700"],
  variable: "--font-display",
});

// El cuerpo va en Outfit, no Inter — el dashboard original (os.css, ya
// retirado) lo usaba y el sistema nuevo lo mantiene. Ver
// docs/sistema-de-diseno.md · Tipografía.
const outfit = Outfit({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "IArcanIA",
  description: "Automatización con IA para PYMEs colombianas",
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
