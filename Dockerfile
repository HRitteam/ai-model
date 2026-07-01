FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source code
COPY src/ ./src/
COPY public/ ./public/

# Copy entry files
COPY cloudbaserc.json ./

# Expose the port
EXPOSE 4000

# Start the application
CMD ["node", "src/server.js"]
