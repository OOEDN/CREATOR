# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Install dependencies (Clean install)
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the VITE application
RUN npm run build

# Copy service worker and public assets into dist
RUN cp -r public/* dist/ 2>/dev/null || true

# Expose the port the app runs on
ENV PORT=8080
EXPOSE 8080

# Start the application
CMD ["npm", "start"]
