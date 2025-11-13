# --- build stage
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy all package files for workspace resolution
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (monorepo aware, skip postinstall scripts)
RUN npm ci --ignore-scripts

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

# Copy backend package files
COPY backend/package*.json ./

# Install ONLY backend production dependencies (ignore workspace)
RUN npm ci --omit=dev --ignore-scripts

# Copy built artifacts from build stage
COPY --from=build /monorepo/backend/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]
