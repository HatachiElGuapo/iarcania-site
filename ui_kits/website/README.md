# IArcanIA Website UI Kit

## Overview
Interactive click-through prototype of the IArcanIA marketing website.
Recreates the full single-page landing: Navbar → Hero → Services → How It Works → Why Us → Fundadores → Footer.

## Source
- `HatachiElGuapo/iarcania` — `frontend/` (Next.js) and `index.html` (static)
- Stack: Next.js 14+, React, TypeScript, Tailwind CSS

## Components
- `Navbar.jsx` — Fixed navbar with scroll effect + mobile menu
- `Hero.jsx` — Full-height hero with blobs, stats counter, CTAs
- `Services.jsx` — 3-col service cards grid
- `HowItWorks.jsx` — 4-step process with connecting line
- `WhyUs.jsx` — Metrics panel + value propositions
- `Fundadores.jsx` — Founders offer section with Calendly modal
- `Footer.jsx` — Simple footer with nav links

## Usage
Open `index.html` to see the full interactive prototype.
Each component is also available as a standalone JSX file.

## Design Notes
- All backgrounds are dark (`#090910` / `#0f0f1a`). Never use light surfaces.
- Fonts: Playfair Display (headings) + Inter (body) — loaded from Google Fonts
- Primary action: purple gradient CTA. Gold for data/emphasis only.
- Animations: scroll reveal + blob floats are pre-wired.
