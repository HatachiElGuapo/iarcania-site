# IArcanIA Design System

## Company Overview

**IArcanIA** — Automatización con IA para negocios colombianos.

IArcanIA diseña e implementa agentes de inteligencia artificial para pequeñas y medianas empresas en Colombia. Automatiza procesos repetitivos: atención al cliente 24/7 por WhatsApp, seguimiento de ventas y leads, gestión de inventario con alertas, y captura de clientes desde sitio web. Se integra con las herramientas que los negocios ya usan (hojas de cálculo, correo, CRM) sin curvas de aprendizaje.

**Audience:** Dueños de negocios colombianos, pymes que quieren crecer sin contratar más personal.

## Sources

- **Codebase:** `HatachiElGuapo/iarcania` (GitHub) — Next.js 14+ App Router, React, TypeScript, Tailwind CSS, Supabase, Calendly integration.
  - Main marketing site: `index.html` (static HTML version) and `frontend/` (Next.js app)
  - Key components: `frontend/components/` (Hero, Navbar, Services, HowItWorks, WhyUs, FundadoresSection, DiagnosticoAgent, Footer)
  - Global styles: `frontend/app/globals.css`

---

## Products

1. **Marketing Website** — Single-page landing for lead capture. Sections: Hero, Services, How It Works, Why Us, Fundadores (founders offer), Diagnóstico Agent, Contact, Footer.
2. **AI Diagnostic Agent** — Interactive embedded chat widget that qualifies leads before booking.
3. **Servicios/Sitios Web** — Secondary page for web design services.

---

## CONTENT FUNDAMENTALS

### Voice & Tone
- **Direct and no-nonsense:** Gets to the point immediately. No filler.
- **Local and contextual:** Explicitly names Colombia. References tools and workflows Colombian SMBs actually use.
- **Anti-jargon:** Explains AI capabilities in plain terms. Never says "machine learning," "LLM," etc.
- **Results-first:** Leads with measurable outcomes (-92% response time, 20h/week saved).
- **Soft urgency:** Uses scarcity ("Solo 10 cupos") but always follows with "Sin costo · Sin compromiso."

### Casing & Language
- **Spanish (Colombia):** All copy is in Colombian Spanish. Informal "tú" register.
- **Headline casing:** Sentence case for all headings (not Title Case).
- **Section labels:** ALL CAPS, 12px, gold color, letter-spacing 2px.
- **No emoji in production headlines** — emoji appear only in service icon placeholders and the FundadoresSection cards. NOT in CTAs, stats, or main headings.

### CTA Copy Pattern
- Written in **first person of the buyer**: "Quiero automatizar mi negocio" not "Contáctanos"
- Arrow → appended to primary CTAs
- Secondary disclaimer always follows: "Llamada de 20 minutos · Sin costo · Sin compromiso"

### Specific Brand Phrases
- "Tu negocio trabaja sin parar. Tú decides cuándo."
- "En marcha en días, no meses."
- "Sin que tengas que cambiar cómo trabajas."
- "Hecho para Colombia"
- "Quiero mi cupo →"
- "Solo 10 cupos." / "Quedan X/10 cupos"

### Numbers & Stats
- Always without decimals: "20h", "80%", "-92%"
- Displayed in Playfair Display with gradient-text treatment
- Used in context: "-92% tiempo de respuesta · -78% tareas manuales · 20h/semana ahorradas"

---

## VISUAL FOUNDATIONS

### Color System
Dark-first palette. Background is always `#090910`. Purple is the primary action color; gold is emphasis/data.

| Token | Value | Usage |
|---|---|---|
| `--bg-deep` | `#090910` | Root background, always present |
| `--bg-dark` | `#0f0f1a` | Alternating sections (Services, Contact, Fundadores) |
| `--bg-card` | `#13131f` | Cards and floating containers |
| `--bg-card-2` | `#17172a` | Modal headers, inner layers |
| `--purple-deep` | `#7c3aed` | CTA gradient start, button glow, scrollbar |
| `--purple-mid` | `#a855f7` | CTA gradient end, border hover |
| `--purple-light` | `#c084fc` | Tags, accent text, gradient-text start |
| `--gold` | `#d4af37` | Section labels, metric values, link hover |
| `--gold-light` | `#f0d060` | gradient-text end |
| `--gold-muted` | `#b8962e` | Section separators |
| `--text-primary` | `#f1f0f7` | Headings, primary text |
| `--text-muted` | `#9896b0` | Body, descriptions, subtitles |
| `--text-dim` | `#5a5870` | Footer, metadata, tertiary text |
| `--border` | `rgba(168,85,247,0.15)` | Standard card border |
| `--border-gold` | `rgba(212,175,55,0.25)` | Service icon and stat borders |
| `--glow-purple` | `rgba(124,58,237,0.40)` | Primary button box-shadow |
| `--glow-gold` | `rgba(212,175,55,0.20)` | Decorative background diffusion |

### Typography

**Playfair Display** (Google Fonts, weights 600/700)
- All H1/H2/H3 section headings
- Stat numbers (20h / 80% / 24/7)
- Step numbers (01–04)
- H1: `clamp(40px, 6vw, 72px)` · H2: `clamp(28px, 4vw, 44px)` · Stats: 36px · Steps: 22px

**Inter** (Google Fonts, weights 300/400/500/600/700)
- Everything else: body, nav, CTAs, tags, labels
- Body: 15–17px · Secondary: 13–14px · Micro-tags: 11px

**Logo Wordmark** — Georgia serif · 18px · weight 700 · letter-spacing 0.15em
- "I" and "IA" in `#94A3B8` · "Arcan" in `#F1F0F7`

### Backgrounds
- Always dark (`#090910` or `#0f0f1a`). Never white or light gray.
- **Noise overlay:** SVG fractalNoise, `opacity: 0.4`, fixed position on `body::before`. Gives subtle grain.
- **Blob decorations:** `radial-gradient` circles with `filter: blur(90px)`. Purple `rgba(124,58,237,0.25)` and gold `rgba(212,175,55,0.12)`. Animated with `float1/float2/float3` keyframes (8–12s).
- **Grid pattern:** 60×60px `linear-gradient` at 4% opacity purple. Hero only.
- **Section separators:** 1px `linear-gradient(90deg, transparent, COLOR, transparent)`. Alternates purple-deep and gold-muted.

### Cards
- Background `#13131f` · border `rgba(168,85,247,0.15)` · `border-radius: 16px`
- Padding `36px 32px`
- Hover: `translateY(-4px)` + border brightens to `rgba(168,85,247,0.35)` + `transition: 0.3s`
- Accent top line on hover: `linear-gradient(90deg, purple-deep, gold)`, `scaleX(0→1)` from left

### Buttons
- **Primary:** `linear-gradient(135deg, #7c3aed → #a855f7)` · `box-shadow: 0 0 30px rgba(124,58,237,0.35)` · white text · `border-radius: 8px`
  - Hover: `translateY(-2px)` + stronger glow
- **Secondary:** Transparent background · `border: 1px solid var(--border)` · muted text
  - Hover: border becomes `--purple-mid`, text becomes primary
- **Gold CTA (Fundadores):** `linear-gradient(135deg, #b8860b → #daa520)` — used only in the founders section

### Gradient Text
`linear-gradient(135deg, #c084fc 0%, #f0d060 100%)` applied via `-webkit-background-clip: text`.
Used on one key word/phrase per H2. Never on body copy.

### Section Labels
`UPPERCASE · 12px · letter-spacing: 2px · color: var(--gold) · font-weight: 600`
Preceded by a 24×1px gold line via `::before`.

### Tags / Chips
`border-radius: 100px · 11px · padding: 4px 10px · font-weight: 600`
- Purple: `bg rgba(124,58,237,0.12)` · border `rgba(124,58,237,0.2)` · text `#c084fc`
- Gold: `bg rgba(212,175,55,0.08)` · border `rgba(212,175,55,0.2)` · text `#d4af37`

### Animations
- **Scroll reveal:** `.reveal` class — `opacity: 0` + `translateY(28px)` → visible on IntersectionObserver. Staggered delays 0.1–0.4s.
- **Blob float:** `translate` keyframes, 8–12s infinite, `ease-in-out`
- **Counter animation:** cubic-ease number count-up on hero stats
- **Metric bars:** `width: 0 → N%` over 1.5s on intersection
- **Pulse gold:** hero badge dot pulses opacity + scale, 2s infinite

### Radius System
- `--radius-sm: 8px` (buttons, inputs, small containers)
- `--radius-md: 16px` (service cards, testimonials)
- `--radius-lg: 24px` (contact form, large modals)

### Scrollbar
Custom: 6px wide, track `#090910`, thumb `#7c3aed`, rounded

### Imagery
No photography in the current site. All visuals are:
- SVG-based blobs and gradients
- Emoji used as placeholder service icons
- Metric/stat visualizations (animated bar charts)
- The "El Ojo Arcano" SVG logomark

### Use of Transparency and Blur
- Scrolled navbar: `backdrop-filter: blur(20px)` + `rgba(9,9,16,0.85)` background
- Modal overlay: `backdrop-filter: blur(sm)` + `bg-black/70`
- Card backgrounds use `rgba` for subtle layering
- Border colors are always semi-transparent (never solid)

---

## ICONOGRAPHY

The site uses **emoji** as placeholder service icons (🤖 ⚡ 📈 📚 🌐 🔭). These are purely temporary — they live inside 54×54px gradient containers and should be replaced with a proper icon set.

**No dedicated icon library** is integrated. The codebase uses:
- Inline SVG for the WhatsApp FAB icon (custom path)
- Inline SVG for the arrow on CTAs (stroke-based, `stroke-width: 2.5`)
- Emoji for service card icons (temporary)
- Emoji for "why us" points (temporary)

**Recommended icon set (not yet integrated):** Lucide Icons — matches the stroke weight and minimalist style of the existing SVG arrows. CDN: `https://unpkg.com/lucide@latest`

**Logo — "El Ojo Arcano":**
- 72×72px SVG mandorla (eye/almond shape)
- Contour: `#F1F0F7` stroke 1.5px
- Iris circle (r=14): `#94A3B8` stroke 0.75px
- Iris rays (8 radial lines at 45°): `#CBD5E1` stroke 1px opacity 0.7
- Sclera (r=6): fill `#F1F0F7`
- Pupil (r=2.5): fill `#090910`
- Eyelash tips (4 lines at vertices): `#475569` stroke 1px
- Wordmark: Georgia serif, 18px, weight 700, letter-spacing 0.15em

See `assets/logo.svg` for the full SVG asset.

---

## File Index

```
README.md                        ← this file
SKILL.md                         ← agent skill definition
colors_and_type.css              ← all CSS custom properties + semantic vars
assets/
  logo.svg                       ← El Ojo Arcano logomark + wordmark
preview/
  colors-backgrounds.html        ← background color swatches
  colors-brand.html              ← purple + gold palettes
  colors-text-borders.html       ← text and border tokens
  typography-scale.html          ← Playfair + Inter type specimens
  typography-labels.html         ← section labels, tags, gradient text
  components-buttons.html        ← primary, secondary, gold buttons
  components-cards.html          ← service card, metric card
  components-tags-badges.html    ← tags, chips, hero badge
  components-form.html           ← inputs, selects, textarea
  spacing-radius-shadows.html    ← radius system + shadow/glow tokens
  brand-logo.html                ← logo lockup + usage rules
  brand-blobs.html               ← blob decorations + noise texture
ui_kits/
  website/
    README.md
    index.html                   ← interactive website prototype
    Navbar.jsx
    Hero.jsx
    Services.jsx
    HowItWorks.jsx
    WhyUs.jsx
    Fundadores.jsx
    Footer.jsx
```
