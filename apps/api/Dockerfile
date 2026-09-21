# syntax=docker/dockerfile:1
# Multi-stage build for the Telco API (system under test).

# ---- builder ---------------------------------------------------------------
FROM node:25-bookworm-slim AS builder
WORKDIR /app

# Install workspace dependencies (root + api) using the committed lockfile.
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci

# Compile TypeScript -> dist
COPY apps/api ./apps/api
RUN npm run build --workspace apps/api

# ---- runner ----------------------------------------------------------------
FROM node:25-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only. npm itself is then removed from the runtime
# image: the app starts with `node`, never npm, so shipping a package manager
# (and its own transitive CVEs, e.g. bundled picomatch) only widens the attack
# surface. This keeps the final image clean under Trivy.
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev \
 && npm cache clean --force \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

# Compiled app + raw SQL assets needed at runtime (migrations / seed).
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/database/sql ./apps/api/dist/database/sql

EXPOSE 3000
USER node

# OpenTelemetry SDK must be required BEFORE the app code.
CMD ["node", "--require", "./apps/api/dist/observability/instrumentation.js", "apps/api/dist/server.js"]
