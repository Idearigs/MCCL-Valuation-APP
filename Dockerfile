# ── Stage 1: build the web app and bundle the API ─────────────────────────────
FROM node:22-bookworm-slim AS build
WORKDIR /src

# Install dependencies first (cached unless a package.json / the lockfile changes)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
# --include=dev: Coolify passes the app's settings as build args, including
# NODE_ENV=production, which would otherwise skip the build tools (tsc, vite).
RUN npm ci --include=dev --no-audit --no-fund

COPY . .
RUN npm run build -w @mccl/web && npm run build -w @mccl/api


# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:22-bookworm-slim
WORKDIR /app/apps/api

# Chromium renders the PDFs; the fonts cover £, accents and symbols in schedules.
# curl is used by Coolify's health check.
RUN apt-get update \
 && apt-get install -y --no-install-recommends chromium fonts-dejavu-core fonts-liberation fonts-noto-core curl \
 && rm -rf /var/lib/apt/lists/*

# Production dependencies of the API only
COPY --from=build /src/package.json /src/package-lock.json /app/
COPY --from=build /src/apps/api/package.json /app/apps/api/
COPY --from=build /src/apps/web/package.json /app/apps/web/
COPY --from=build /src/packages/shared/package.json /app/packages/shared/
RUN cd /app && npm ci --omit=dev --workspace @mccl/api --no-audit --no-fund && npm cache clean --force

# sharp's native Linux binary needs an x86-64-v2 CPU, which some virtual servers don't
# expose. sharp falls back to its WebAssembly build automatically when the native one
# can't load, but npm won't install that build on x64, so add it by hand.
RUN cd /app \
 && SHARP_VERSION=$(node -p "require('./node_modules/sharp/package.json').version") \
 && npm pack --silent "@img/sharp-wasm32@${SHARP_VERSION}" \
 && mkdir -p node_modules/@img/sharp-wasm32 \
 && tar -xzf img-sharp-wasm32-*.tgz -C node_modules/@img/sharp-wasm32 --strip-components=1 \
 && rm img-sharp-wasm32-*.tgz && npm cache clean --force

COPY --from=build /src/apps/api/dist ./dist
COPY --from=build /src/apps/api/drizzle ./drizzle
COPY --from=build /src/apps/api/assets ./assets
COPY --from=build /src/apps/web/dist /app/web

ENV NODE_ENV=production \
    PORT=5000 \
    WEB_DIST_DIR=/app/web \
    PDF_RENDERER=chrome \
    CHROME_PATH=/usr/bin/chromium \
    STORAGE_DRIVER=local \
    LOCAL_STORAGE_DIR=/app/uploads/v2 \
    LEGACY_UPLOADS_DIR=/app/uploads

# Persistent volume in Coolify: /app/uploads (existing photos stay where they are;
# v2 keeps its files in /app/uploads/v2)
VOLUME ["/app/uploads"]
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:5000/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--import", "./dist/instrument.js", "dist/server.js"]
