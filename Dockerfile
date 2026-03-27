## ─────────────────────────────────────────────────────────────────────────────
## Stage 1: Build (includes dev dependencies + toolchain)
## ─────────────────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies (including dev deps) for build
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

## ─────────────────────────────────────────────────────────────────────────────
## Stage 2: Runtime (tiny nginx image serving dist/)
## ─────────────────────────────────────────────────────────────────────────────
FROM nginx:alpine AS runtime

# SPA routing + sensible caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static site output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
