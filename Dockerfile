FROM oven/bun:alpine AS base

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Stage 2: Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy DATABASE_URL so drizzle.ts doesn't throw at build time (real URL set at runtime)
ENV DATABASE_URL=postgres://build:build@localhost:5432/build
RUN bun run build

# Stage 3: Production server
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# Migrations: run before start so DB has schema
COPY --from=builder /app/app/db/migrations ./migrations
COPY --from=builder /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=builder /app/node_modules/postgres ./node_modules/postgres

EXPOSE 3000
CMD ["sh", "-c", "bun run scripts/migrate.mjs && exec bun run server.js"]
