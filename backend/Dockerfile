# --- build
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy root package files (monorepo workspace)
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install all dependencies (including workspace dependencies)
RUN npm ci

# Copy backend source
COPY backend/tsconfig.json ./backend/
COPY backend/tsup.config.ts ./backend/
COPY backend/src ./backend/src

# Build backend
RUN npm run build:backend

# --- run
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Copy only backend package files for production
COPY backend/package*.json ./

# Copy root package files for workspace resolution
COPY package*.json /monorepo/
RUN cd /monorepo && npm ci --omit=dev --workspace=backend

# Copy built dist from build stage
COPY --from=build /monorepo/backend/dist ./dist

EXPOSE 5000
CMD ["node", "dist/index.js"]
