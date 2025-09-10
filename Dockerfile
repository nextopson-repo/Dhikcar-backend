FROM node:20-alpine AS builder

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript files
RUN npm run build

# Development stage
FROM node:20-alpine AS development

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies including dev dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose port 8080
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=development
ENV PORT=8080

# Start the app in development mode
CMD ["npm", "run", "dev"]

# Production stage
FROM node:20-alpine AS production

# Create app directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose port 8080
EXPOSE 8080

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Start the app
CMD ["node", "dist/index.js"]
