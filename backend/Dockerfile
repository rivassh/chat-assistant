FROM node:18 AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY prisma ./prisma
RUN npx prisma generate

FROM base AS build
COPY package.json package-lock.json* ./
RUN npm ci
COPY prisma ./prisma
COPY src ./src
COPY .env* ./
RUN npx prisma generate

FROM node:18-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /usr/lib/x86_64-linux-gnu/libssl.so.3 /usr/lib/x86_64-linux-gnu/
COPY --from=build /usr/lib/x86_64-linux-gnu/libcrypto.so.3 /usr/lib/x86_64-linux-gnu/
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY package.json ./
ENV PRISMA_QUERY_ENGINE_LIBRARY=/app/node_modules/.prisma/client/libquery_engine-debian-openssl-3.0.x.so.node
EXPOSE 3001
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]