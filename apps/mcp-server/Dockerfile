# type: dockerfile
# description: Container image for the hosted Landschaft MCP HTTP bridge.
# last-updated: 2026-07-02
# last-model: codex-gpt-5
# last-change: add production backend container
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mcp-server/package.json apps/mcp-server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN npm ci

COPY tsconfig.base.json ./
COPY apps/mcp-server apps/mcp-server
COPY packages/shared packages/shared

RUN npm run build -w @landschaft/shared && npm run build -w @landschaft/mcp-server

ENV NODE_ENV=production
ENV LANDSCHAFT_MCP_HTTP_HOST=0.0.0.0
ENV LANDSCHAFT_MCP_STDIO=false
ENV LANDSCHAFT_PROVIDER_ASSET_ROOT=/tmp/landschaft-provider-assets

EXPOSE 8787

CMD ["npm", "run", "start", "-w", "@landschaft/mcp-server"]
