FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Expose Vite port (default 5173)
EXPOSE 5173

# Default command for development (bind to 0.0.0.0 for container access)
CMD ["npm", "run", "dev", "--", "--host"]
