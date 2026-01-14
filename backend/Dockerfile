# --- build stage
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy all package files for workspace resolution
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (monorepo aware, skip postinstall scripts)
RUN npm ci --ignore-scripts

# Build shared package first
COPY packages/shared ./packages/shared
RUN npm run build --workspace=@livechat/shared

# Copy backend source files
COPY backend/tsconfig.json ./backend/
COPY backend/tsup.config.ts ./backend/
COPY backend/src ./backend/src

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

# Copy packages package files (needed for workspace resolution)
COPY backend/package*.json ./backend/
COPY packages/shared/package*.json ./packages/shared/

# Install ONLY production dependencies using workspace
# We need packages/shared to be present for the link to work
RUN npm ci --omit=dev --ignore-scripts --workspace=backend

# Copy built artifacts from build stage
COPY --from=build /monorepo/backend/dist ./backend/dist
COPY --from=build /monorepo/packages/shared/dist ./packages/shared/dist

# Set working directory to backend
WORKDIR /app/backend

EXPOSE 5000
CMD ["node", "dist/index.js"]
