# Build context is the MONOREPO ROOT, not this directory -- see
# railway.json's build.dockerfilePath. npm workspaces need the root
# package.json/package-lock.json and every workspace's package.json present
# to resolve apps/api's "@roster-duel/sim-engine": "*" dependency; there's
# no way to build apps/api in isolation from an apps/api-scoped context.
FROM node:22-alpine

# Prisma's query engine needs OpenSSL on Alpine (musl) -- without this the
# app fails at startup with a "libssl.so.3 not found" engine-load error,
# not a build-time error, so it's easy to miss until first deploy.
RUN apk add --no-cache openssl

WORKDIR /repo

COPY . .

# Root package.json's postinstall builds packages/sim-engine automatically
# -- apps/api depends on its compiled dist/, not its source.
RUN npm ci

# Reads only the schema file -- no live DATABASE_URL needed at build time.
RUN npm run prisma:generate -w apps/api

RUN npm run build -w apps/api

ENV NODE_ENV=production
EXPOSE 4000

# Apply any new database migrations before the API starts, so a deploy that
# adds a migration needs no manual step. `prisma migrate deploy` only runs
# migrations not yet recorded in _prisma_migrations, so it's a no-op when
# nothing is new. If it fails, the container exits, the health check never
# passes, and Railway keeps the previous deployment serving.
CMD ["sh", "-c", "npm run prisma:deploy -w apps/api && npm run start:prod -w apps/api"]
