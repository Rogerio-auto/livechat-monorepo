# --- build stage
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy all package files for workspace resolution
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (monorepo aware, skip postinstall scripts)
RUN npm ci --ignore-scripts

# Copy backend source files
COPY backend/tsconfig.json ./backend/
COPY backend/tsup.config.ts ./backend/
COPY backend/src ./backend/src
COPY packages/shared ./packages/shared

# Build backend
RUN npm run build:backend

# --- production stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install system dependencies (ffmpeg for audio conversion)
RUN apk add --no-cache ffmpeg

# Copy root package files (needed for workspace resolution)
COPY package*.json ./

# Copy backend package files
COPY backend/package*.json ./backend/

# Install ONLY backend production dependencies using workspace
RUN npm ci --omit=dev --ignore-scripts --workspace=backend

# Copy built artifacts from build stage
COPY --from=build /monorepo/backend/dist ./backend/dist

# Set working directory to backend
WORKDIR /app/backend

EXPOSE 5000
CMD ["node", "dist/index.js"]
