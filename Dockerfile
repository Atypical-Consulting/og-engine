FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies (better-sqlite3 needs python3 + build tools)
FROM base AS deps
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile --production --ignore-scripts && \
    bunx node-gyp rebuild --release --directory=node_modules/better-sqlite3

# Build docs site (Astro + Starlight)
FROM base AS docs
WORKDIR /app/docs/site
COPY docs/site/package.json docs/site/bun.lock* ./
RUN bun install --frozen-lockfile
COPY docs/site/ ./
RUN bun run build

# Runner stage — no build tools needed
FROM base AS runner
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY scripts/ ./scripts/
RUN bun run scripts/download-fonts.ts

# Copy Astro build output
COPY --from=docs /app/docs/site/dist ./docs-dist

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_URL=file:/data/og-engine.db
ENV AUTH_ENABLED=true

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
