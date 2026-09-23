import type { CSSProperties, ReactNode } from "react";
import type { SlideTipo } from "@/lib/guiones/slides";
import type { BrandTheme } from "@/lib/guiones/brand-theme";

// Capa de CONTENIDO de un slide (absolute inset-0). Quien la usa pone el
// marco 16:9 + fondo + borde (la miniatura en slide-panel, el presentador a
// pantalla completa). Los colores son dinámicos por marca → estilos inline,
// no Tailwind. Tamaños en `em` relativos al `fontSize` base que fija el
// contenedor: la miniatura ~8px, el presentador un clamp grande.

type Slide = {
  tipo: SlideTipo | string;
  textoPrincipal: string;
  textoSecundario?: string | null;
};

export function SlideView({
  slide,
  theme,
  variant = "thumb",
}: {
  slide: Slide;
  theme: BrandTheme;
  variant?: "thumb" | "full";
}) {
  const full = variant === "full";
  const p = slide.textoPrincipal || "";
  const s = slide.textoSecundario || "";
  const { primario, texto } = theme;
  const logo = theme.logoUrl;

  const wrap: CSSProperties = {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: full ? "5% 9%" : "8%",
    textAlign: "center",
    color: texto,
    lineHeight: 1.25,
    fontFamily: theme.tipografia ? `'${theme.tipografia}', sans-serif` : undefined,
    fontSize: full ? "clamp(15px, 3.3vw, 40px)" : "8px",
  };

  const img = (max: string) =>
    logo ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt=""
        style={{ maxHeight: max, maxWidth: "40%", objectFit: "contain", opacity: 0.85 }}
      />
    ) : null;

  let inner: ReactNode = null;
  switch (slide.tipo as SlideTipo) {
    case "portada":
      inner = (
        <div style={col("center", "0.7em")}>
          {img("1.6em")}
          <div style={{ fontSize: "1.7em", fontWeight: 700, lineHeight: 1.1 }}>{p}</div>
          {s && <div style={{ fontSize: "0.95em", opacity: 0.6 }}>{s}</div>}
        </div>
      );
      break;
    case "punto":
      inner = (
        <div style={{ ...col("flex-start", "0.55em"), textAlign: "left" }}>
          <div style={{ fontSize: "1.55em", fontWeight: 700, lineHeight: 1.18 }}>{p}</div>
          {s && <div style={{ fontSize: "0.9em", opacity: 0.6, lineHeight: 1.5 }}>{s}</div>}
        </div>
      );
      break;
    case "cita":
      inner = (
        <div style={{ ...col("center", "0.3em"), maxWidth: "92%" }}>
          <div
            style={{
              fontSize: "3em",
              lineHeight: 0.6,
              color: primario,
              opacity: 0.4,
              fontFamily: "Georgia, serif",
            }}
          >
            &ldquo;
          </div>
          <div style={{ fontSize: "1.3em", fontStyle: "italic", fontWeight: 500, lineHeight: 1.4 }}>
            {p}
          </div>
          {s && <div style={{ fontSize: "0.85em", opacity: 0.55 }}>— {s}</div>}
        </div>
      );
      break;
    case "dato":
      inner = (
        <div style={{ ...col("center", "0.25em"), maxWidth: "92%" }}>
          <div style={{ fontSize: "3.4em", fontWeight: 800, lineHeight: 1, color: primario }}>{p}</div>
          {s && <div style={{ fontSize: "0.95em", opacity: 0.6 }}>{s}</div>}
        </div>
      );
      break;
    case "cierre":
      inner = (
        <div style={col("center", "0.7em")}>
          <div style={{ fontSize: "1.5em", fontWeight: 700, lineHeight: 1.2 }}>{p}</div>
          {s && <div style={{ fontSize: "0.85em", opacity: 0.55 }}>{s}</div>}
          {img("1.4em")}
        </div>
      );
      break;
    default:
      inner = <div style={{ fontSize: "1.3em" }}>{p}</div>;
  }

  return <div style={wrap}>{inner}</div>;
}

function col(align: CSSProperties["alignItems"], gap: string): CSSProperties {
  return { display: "flex", flexDirection: "column", alignItems: align, gap, width: "100%" };
}
