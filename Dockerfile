# Kickstead API — production image.
# Build context is the repo root (the backend needs database/prisma for the Prisma client).
#   docker build -t kickstead-api .
#   docker run --env-file /opt/kickstead/.env -p 80:4000 kickstead-api

# ---- build: install everything, generate the Prisma client, compile TypeScript ----
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
# npm ci validates the lockfile against every workspace manifest, so copy all three.
COPY package.json package-lock.json ./
COPY database/package.json database/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --workspace database --include-workspace-root --ignore-scripts
COPY database/prisma database/prisma
COPY backend backend
RUN npx prisma generate --schema database/prisma/schema.prisma \
 && npm run build -w backend

# ---- runtime deps: production dependencies only (no Prisma CLI, no dev tools) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY database/package.json database/
COPY backend/package.json backend/
COPY frontend/package.json frontend/
# The Prisma CLI and TypeScript (and their trees, incl. deepmerge-ts) are "devOptional" in the
# lockfile: dev for us, optional peers of @prisma/client. npm drops them only when BOTH dev and
# optional are omitted. No runtime dependency is optional, so this removes tooling only.
RUN npm ci --omit=dev --omit=optional --workspace backend --ignore-scripts \
 && npm cache clean --force

# ---- runtime ----
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=4000
WORKDIR /app
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
# The generated client (incl. the Linux query engine) lives in node_modules/.prisma.
COPY --from=build --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --chown=node:node backend/package.json ./backend/package.json
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/server.js"]
