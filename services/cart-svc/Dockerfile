# syntax=docker/dockerfile:1
# node:22-bookworm-slim — pinned to immutable SHA digest for supply chain security.
FROM node:22-bookworm-slim@sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96 AS build
WORKDIR /app
COPY services/cart-svc/package*.json services/cart-svc/.npmrc ./
RUN --mount=type=secret,id=NODE_AUTH_TOKEN \
    export NODE_AUTH_TOKEN=$(cat /run/secrets/NODE_AUTH_TOKEN) && npm ci --ignore-scripts

FROM node:22-bookworm-slim@sha256:4d676821dff059fd00d277ee4261ef34ea712317fed0737c03941481b5760c96
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node services/cart-svc/src ./src
USER node
EXPOSE 3004
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD ["node", "src/healthcheck.js"]
ENTRYPOINT ["node"]
CMD ["src/index.js"]
