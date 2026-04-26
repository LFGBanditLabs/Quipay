FROM node:22-alpine

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --retries=5 --start-period=20s \
	CMD wget -qO- http://localhost:3001/health | grep -q '"status":"ok"' || exit 1

# Hot reload is handled via volume mount and npm run dev in docker-compose
CMD ["npm", "run", "dev"]
