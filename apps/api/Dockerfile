# syntax=docker/dockerfile:1
# Multi-stage build for the Telco API (system under test).

# ---- builder ---------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Install workspace dependencies (root + api) using the committed lockfile.
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci

# Compile TypeScript -> dist
COPY apps/api ./apps/api
RUN npm run build --workspace apps/api

# ---- runner ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Production dependencies only.
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/package.json
RUN npm ci --omit=dev && npm cache clean --force

# Compiled app + raw SQL assets needed at runtime (migrations / seed).
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/src/database/sql ./apps/api/dist/database/sql

EXPOSE 3000
USER node

# OpenTelemetry SDK must be required BEFORE the app code.
CMD ["node", "--require", "./apps/api/dist/observability/instrumentation.js", "apps/api/dist/server.js"]
