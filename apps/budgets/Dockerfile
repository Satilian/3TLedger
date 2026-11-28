FROM node:26-bookworm-slim AS build
WORKDIR /app

RUN npm install --global pnpm@11
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN PORT=3003 pnpm build --mode production --no-env && pnpm prune --prod

FROM node:26-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3003
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node
EXPOSE 3003
CMD ["node", "dist/server.js"]
