# Dos etapas: solo los archivos compilados y el servidor llegan a la imagen final.
FROM node:22.23.4-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22.23.4-alpine AS runtime
ENV NODE_ENV=production PORT=8080 BATTLEHUB_AUTH_MODE=auth0
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node src/server/server.mjs ./src/server/server.mjs
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "src/server/server.mjs"]
