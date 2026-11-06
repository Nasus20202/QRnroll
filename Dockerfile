FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS builder
WORKDIR /app
# renovate: datasource=npm depName=corepack
ARG COREPACK_VERSION=0.36.0
RUN npm install -g corepack@${COREPACK_VERSION} && corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:26.13-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216
WORKDIR /app
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server-entry.mjs ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

USER node
CMD ["node", "server-entry.mjs"]
