# --- build stage
FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy all package files for workspace resolution
COPY package*.json ./
COPY cadastro/package*.json ./cadastro/

# Install all dependencies (monorepo aware, skip postinstall scripts)
RUN npm ci --ignore-scripts

# Copy cadastro source files
COPY cadastro ./cadastro/

# Build arguments for Vite (must be passed at build time)
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_APP_BASE_PATH=/
ARG VITE_PUBLIC_URL

# Export as environment variables for Vite build
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_APP_BASE_PATH=${VITE_APP_BASE_PATH}
ENV VITE_PUBLIC_URL=${VITE_PUBLIC_URL}

# Build cadastro
RUN npm run build:cadastro

# --- production stage
FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

# Copy nginx configuration (use frontend's nginx.conf as template)
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Copy built artifacts from build stage
COPY --from=build /monorepo/cadastro/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
