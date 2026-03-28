# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN NODE_ENV=development npm ci
COPY . .
RUN npm run build

# Stage 2: Production server (Express serves everything)
FROM node:20-alpine
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev

COPY server/ ./
COPY --from=frontend-build /app/dist ./dist

EXPOSE 5000
ENV NODE_ENV=production

# Uploaded images — configure persistent volume in Coolify: /app/uploads
VOLUME ["/app/uploads"]

CMD ["node", "index.js"]
