FROM node:20-slim
WORKDIR /app

# Install curl, tar, and ca-certificates for downloading Coral and external API communication
RUN apt-get update && apt-get install -y curl tar ca-certificates && rm -rf /var/lib/apt/lists/*

# Download and install the Linux x86_64 Coral binary
RUN curl -L https://github.com/withcoral/coral/releases/download/v0.4.2/coral-x86_64-unknown-linux-gnu.tar.gz \
    | tar -xz && mv coral /usr/local/bin/coral && chmod +x /usr/local/bin/coral

# Copy package files and install dependencies
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci

# Copy the rest of the application files
COPY . .

# Build both frontend (Vite React app) and backend (Express TypeScript app)
RUN npm run build:all

# Make the start script executable
RUN chmod +x start.sh

# Expose the backend port
EXPOSE 3001

# Execute runtime start script
CMD ["bash", "start.sh"]
