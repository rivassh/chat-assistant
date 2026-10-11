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
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY package.json ./
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates wget && \
    wget -q http://deb.debian.org/debian/pool/main/o/openssl/libssl1.1_1.1.1w-0+deb11u1_amd64.deb -O /tmp/libssl1.1.deb && \
    dpkg -i /tmp/libssl1.1.deb && \
    rm /tmp/libssl1.1.deb && \
    rm -rf /var/lib/apt/lists/*
EXPOSE 3001
COPY start.sh /start.sh
RUN chmod +x /start.sh
CMD ["/start.sh"]