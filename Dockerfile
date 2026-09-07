# syntax=docker/dockerfile:1.7
FROM ghcr.io/gitleaks/gitleaks:v8.30.1 AS gitleaks
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV COREPACK_HOME=/opt/corepack
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate
COPY --from=gitleaks /usr/bin/gitleaks /usr/local/bin/gitleaks

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS development
COPY . .
RUN mkdir -p .next /var/lib/executiveos/files /var/lib/executiveos/backups && chown -R node:node .next /var/lib/executiveos
EXPOSE 3000
CMD ["pnpm", "dev"]

FROM deps AS builder
COPY . .
RUN pnpm build

# PostgreSQL's official image supplies matching v16 client binaries and their shared libraries.
FROM postgres:16-bookworm AS runtime
RUN groupadd --gid 1001 executiveos && useradd --uid 1001 --gid executiveos --create-home executiveos
COPY --from=base /usr/local/bin/node /usr/local/bin/node
COPY --from=base /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=base /opt/corepack /opt/corepack
RUN ln -s ../lib/node_modules/corepack/dist/pnpm.js /usr/local/bin/pnpm
WORKDIR /app
COPY --from=builder --chown=executiveos:executiveos /app/.next/standalone ./
COPY --from=builder --chown=executiveos:executiveos /app/.next/static ./.next/static
COPY --from=builder --chown=executiveos:executiveos /app/public ./public
COPY --from=builder --chown=executiveos:executiveos /app/src ./src
COPY --from=builder --chown=executiveos:executiveos /app/scripts ./scripts
COPY --from=builder --chown=executiveos:executiveos /app/drizzle ./drizzle
COPY --from=builder --chown=executiveos:executiveos /app/tsconfig.json /app/package.json /app/pnpm-lock.yaml ./
COPY --from=deps --chown=executiveos:executiveos /app/node_modules ./node_modules
RUN mkdir -p /var/lib/executiveos/files /var/lib/executiveos/backups && chown -R executiveos:executiveos /var/lib/executiveos
USER executiveos
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000 COREPACK_HOME=/opt/corepack
EXPOSE 3000
ENTRYPOINT []
CMD ["node", "server.js"]
