# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Argus platform — Next.js 16 standalone production image.
# Multi-stage: deps → builder → runner. Final image runs `node server.js`
# from the Next.js standalone output as a non-root user.
# ---------------------------------------------------------------------------

# ---- Stage: deps ---------------------------------------------------------
# Install production + build dependencies against a clean lockfile.
FROM node:26-alpine AS deps
# libc6-compat is required for some native/prebuilt binaries on Alpine (musl).
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- Stage: builder ------------------------------------------------------
# Compile the Next.js app into the standalone server bundle.
FROM node:26-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Public (NEXT_PUBLIC_*) vars are inlined at build time — pass via --build-arg.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ---- Stage: runner -------------------------------------------------------
# Minimal runtime: only the standalone server, static assets and public files.
FROM node:26-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Run as an unprivileged user (uid/gid 1001).
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

# Standalone output already contains a minimal node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Liveness probe hits the app's health route (see app/api/health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
