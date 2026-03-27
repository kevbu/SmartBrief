FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY package*.json ./
# Skip postinstall (prisma generate) — schema isn't available yet at this layer
RUN npm ci --ignore-scripts
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push && npm start"]
