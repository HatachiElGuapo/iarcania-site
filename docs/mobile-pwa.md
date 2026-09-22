# App web instalable (PWA)

## Qué ya hay

- `public/manifest.webmanifest` + `public/icons/` (generados de `icon-source.svg`,
  recortado del "ojo arcano" de `assets/logo.svg` del diseño) — nombre, íconos,
  `display: "standalone"` (sin barra de navegador) y `start_url: "/dashboard"`.
- `app/layout.tsx` referencia el manifest, los íconos (favicon + apple-touch-icon)
  y `appleWebApp` para que iOS trate la app como "instalada" al agregarla a
  inicio.

Con esto, "Agregar a pantalla de inicio" en **iOS Safari** ya debería dar un
ícono propio y abrir sin barra de navegador — iOS no exige HTTPS para esto,
así que debería funcionar incluso entrando por la IP local
(`http://192.168.1.28:3001`).

## Qué falta para que también instale en Android/Chrome

Chrome (Android y escritorio) exige **origen seguro** (HTTPS, o `localhost`)
para ofrecer el banner de "Instalar app" — con `http://192.168.1.28:3001` no
va a aparecer, sin importar cuánto se ajuste el manifest.

Eso significa que el paso que falta no es de código, es de infraestructura:
un dominio (o subdominio) apuntando a este servidor con un certificado TLS
válido. Opciones típicas, de menor a mayor esfuerzo:

1. **Cloudflare Tunnel** (`cloudflared`) — no requiere abrir puertos en el
   router; da un hostname con HTTPS automático apuntando al contenedor
   `iarcania` (puerto 3001). Es lo más simple si `iarcania.com` (o un
   subdominio suyo) ya está en Cloudflare.
2. **Reverse proxy propio con HTTPS automático** (Caddy es el más simple:
   un `Caddyfile` de pocas líneas le pide el certificado a Let's Encrypt
   solo) — requiere DNS apuntando a la IP pública de este servidor y el
   puerto 443 abierto/redirigido en el router.
3. **Tailscale Funnel** — si el uso real es solo para vos (no público),
   da HTTPS sin exponer nada al internet abierto.

Cualquiera de las tres termina en lo mismo: la app queda accesible por
`https://algo.iarcania.com` en vez de `http://192.168.1.28:3001`, y ahí sí
Chrome ofrece "Instalar app" como cualquier PWA.

## No implementado todavía

Elegir e implementar una de las tres opciones de arriba es una decisión de
infraestructura (expone o no el servidor, quién administra el dominio) que
quedó pendiente de conversación — no se tocó nada del lado de DNS/proxy en
este cambio.
