# syntax=docker/dockerfile:1
# node:22-bookworm-slim — pinned to immutable SHA digest for supply chain security.
FROM node:22-bookworm-slim@sha256:a5a2f04592e9a97e04e9e3b55a8cf66eedc46dd57cdade20546ab42f836a9de4 AS build
WORKDIR /app
COPY services/order-svc/package*.json services/order-svc/.npmrc ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    export NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN) && npm ci --ignore-scripts

FROM node:22-bookworm-slim@sha256:a5a2f04592e9a97e04e9e3b55a8cf66eedc46dd57cdade20546ab42f836a9de4
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node services/order-svc/src ./src
USER node
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD ["node", "src/healthcheck.js"]
ENTRYPOINT ["node"]
CMD ["src/index.js"]
