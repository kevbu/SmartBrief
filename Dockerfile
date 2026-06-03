FROM node:24-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate && npm run build

FROM node:24-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

# Standalone Next.js output (server.js + traced node_modules)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma schema (needed by db push)
COPY --from=builder /app/prisma ./prisma

# Prisma CLI (devDep — not traced into standalone node_modules)
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Generated Prisma client + query engine binaries
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000
CMD ["sh", "-c", "node_modules/.bin/prisma db push && node server.js"]
