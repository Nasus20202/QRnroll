FROM node:24.14-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24.14-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY server-entry.mjs ./

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server-entry.mjs"]
