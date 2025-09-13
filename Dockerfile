FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Create data directory for SQLite database
RUN mkdir -p data

# Expose port (required by some platforms)
EXPOSE 3000

# Start the bot
CMD ["node", "index.js"]
