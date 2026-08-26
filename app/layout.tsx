import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google";
import "./globals.css";

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-display",
});

// os.css usa Outfit para el cuerpo, no Inter — ver NOTES.md "Sistema de
// diseño" (os.css es el dashboard operativo real, colors_and_type.css es
// el sitio de marketing público, sistemas distintos).
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
