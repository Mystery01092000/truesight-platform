# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Truesight platform — Next.js 16 standalone production image.
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

# `next build` imports every route module to collect page data; the Drizzle
# client (@/db) validates DATABASE_URL at import and throws when unset. postgres.js
# connects lazily, so this placeholder is never dialed during the build — ECS
# injects the real SecureString DATABASE_URL at runtime. Build-only, not in runner.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build

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

# Terraform CLI for Forge deploys (arch-aware; pinned version).
ARG TERRAFORM_VERSION=1.9.8
RUN apk add --no-cache curl unzip \
    && ARCH="$(apk --print-arch)" \
    && case "$ARCH" in x86_64) TF_ARCH=amd64 ;; aarch64) TF_ARCH=arm64 ;; *) echo "unsupported arch $ARCH" && exit 1 ;; esac \
    && curl -fsSL "https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_${TF_ARCH}.zip" -o /tmp/tf.zip \
    && unzip -q /tmp/tf.zip -d /usr/local/bin \
    && rm /tmp/tf.zip \
    && terraform version

# Forge terraform workspaces (per-plan main.tf.json + local tfstate).
RUN mkdir -p /app/var/forge && chown -R nextjs:nodejs /app/var

# Standalone output already contains a minimal node_modules + server.js.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Migration bundle — lets a one-off task run `node scripts/migrate.mjs` in-VPC to
# apply schema to the private RDS before the service scales up. The standalone
# trace omits the migrator submodule, so copy the full drizzle-orm + postgres
# packages to guarantee it resolves at runtime (the app itself only pulls the
# driver + query builder).
COPY --from=builder --chown=nextjs:nodejs /app/db/migrations ./db/migrations
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder --chown=nextjs:nodejs /app/scripts/seed.mjs ./scripts/seed.mjs
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/drizzle-orm ./node_modules/drizzle-orm
COPY --from=deps --chown=nextjs:nodejs /app/node_modules/postgres ./node_modules/postgres

USER nextjs

EXPOSE 3000

# Liveness probe hits the app's health route (see app/api/health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
