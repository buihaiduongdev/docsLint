FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=extra_ca if [ -f /run/secrets/extra_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca npm ci; else npm ci; fi
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN --mount=type=secret,id=extra_ca if [ -f /run/secrets/extra_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/extra_ca npm ci --omit=dev; else npm ci --omit=dev; fi
COPY --from=build /app/dist ./dist
COPY server ./server
COPY scripts/office-env.mjs ./scripts/office-env.mjs
EXPOSE 3001
CMD ["node", "server/index.mjs"]
