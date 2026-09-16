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

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y tmux && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY package.json ./
EXPOSE 3001
CMD ["node", "src/index.js"]
