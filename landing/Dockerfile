# --- build stage
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy all package files for workspace resolution
COPY package*.json ./
COPY landing/package*.json ./landing/
COPY packages/shared/package*.json ./packages/shared/

# Install all dependencies (monorepo aware, skip postinstall scripts)
RUN npm ci --ignore-scripts

# Copy shared package source
COPY packages/shared ./packages/shared

# Copy landing source files
COPY landing ./landing/

# Build arguments for Vite
ARG VITE_API_URL
ARG VITE_CADASTRO_URL
ARG VITE_APP_URL

# Export as environment variables for Vite build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CADASTRO_URL=${VITE_CADASTRO_URL}
ENV VITE_APP_URL=${VITE_APP_URL}

# Build landing
RUN npm run build --workspace landing

# --- production stage
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Copy nginx configuration
COPY landing/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from build stage
COPY --from=build /monorepo/landing/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
