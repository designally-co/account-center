# syntax=docker/dockerfile:1

# Account Center's production image: linux/amd64, Node 22, Next.js standalone.
# Built, checked and pushed by .github/workflows/release.yml, and deployed as
# docs/deploy-nas.md describes. Nothing in this file, or in any layer it
# produces, is a secret: runtime values come from Portainer.

# ---- deps ----
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- builder ----
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Every page is dynamic and settings are read at runtime, so the build needs none.
RUN npm run build

# ---- runner ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# The commit this image was built from, reported by /api/health.
ARG APP_COMMIT_SHA=""
ENV APP_COMMIT_SHA=$APP_COMMIT_SHA

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
