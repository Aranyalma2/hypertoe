# Use Alpine-based Node.js for minimal size
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Copy application files
COPY backend ./backend
COPY public ./public

# Expose port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Run as non-root user for security
USER node

# Start application
CMD ["npm", "run", "start"]
