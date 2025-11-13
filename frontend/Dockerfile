# --- build stage
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy all package files for workspace resolution
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (monorepo aware, skip postinstall scripts)
RUN npm ci --ignore-scripts

# Copy frontend source files
COPY frontend ./frontend/

# Build frontend
RUN npm run build:frontend

# --- production stage
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Copy nginx configuration
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from build stage
COPY --from=build /monorepo/frontend/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
