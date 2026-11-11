# Multi-stage Dockerfile for Node.js Backend API & Prisma SQLite
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package manifests and Prisma schema
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm ci
RUN npx prisma generate

# Copy source code and build TypeScript
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production Runner Stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Create directory for persistent SQLite database
RUN mkdir -p /app/data
ENV DATABASE_URL="file:/app/data/prod.db"

EXPOSE 5000

CMD ["sh", "-c", "npx prisma db push && node dist/index.js"]
