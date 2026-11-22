FROM node:24-bookworm-slim AS frontend-build
WORKDIR /app
COPY tools/vendor/typescript ./tools/vendor/typescript
COPY scripts/build-frontend.cjs ./scripts/build-frontend.cjs
COPY frontend ./frontend
RUN node scripts/build-frontend.cjs

FROM node:24-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
COPY --chown=node:node backend ./backend
COPY --chown=node:node database_schema ./database_schema
COPY --chown=node:node scripts ./scripts
COPY --from=frontend-build --chown=node:node /app/frontend/dist ./frontend/dist
COPY --chown=node:node .env.example ./
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "backend/src/server.cjs"]
