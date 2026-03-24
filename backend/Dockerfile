FROM node:22-alpine

WORKDIR /app

# Install dependencies first for caching
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3001

# Hot reload is handled via volume mount and npm run dev in docker-compose
CMD ["npm", "run", "dev"]
