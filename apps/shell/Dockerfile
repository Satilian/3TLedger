FROM node:26-bookworm-slim AS build
WORKDIR /app

RUN npm install --global pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG ANALYTICS_MF_URL
ARG BUDGETS_MF_URL
ARG LEDGER_MF_URL
RUN pnpm build --mode production --no-env && pnpm prune --prod

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
RUN mkdir -p node_modules/.cache && chown -R node:node node_modules/.cache
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
