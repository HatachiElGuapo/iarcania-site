# syntax=docker/dockerfile:1

# ── Etapa 1: dependencias ────────────────────────────────────────────────────
FROM node:20-alpine AS deps
# libc6-compat: requerido por Next.js sobre musl (alpine) para bindings nativos.
# OJO: NO instalar vips-dev/vips — sharp (@img/sharp-*) trae su propio libvips
# estático embebido en el binario precompilado. Si detecta un libvips del
# sistema intenta compilar/enlazar contra él vía node-gyp (que no está
# instalado) y el build falla con "Please add node-addon-api".
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Etapa 2: build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ── Etapa 3: runtime ─────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Best-effort — lib/date/bogota.ts (offset fijo -05:00 + Intl con timeZone
# explícito) es la única fuente de verdad real para fechas de negocio y no
# depende de esto. Se fija igual por si algún log o dependencia de terceros
# usa la hora local del proceso, mismo criterio que GENERIC_TIMEZONE en el
# servicio n8n de este mismo docker-compose.
ENV TZ=America/Bogota

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Salida "standalone": server.js + node_modules mínimos ya trazados por Next
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
