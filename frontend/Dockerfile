FROM node:20-alpine AS build
WORKDIR /monorepo

# Copy root package files (monorepo workspace)
COPY package*.json ./
COPY frontend/package*.json ./frontend/

# Install all dependencies (including workspace dependencies)
RUN npm ci

# Copy frontend source
COPY frontend ./frontend/

# Build frontend
RUN npm run build:frontend

FROM nginx:1.27-alpine
WORKDIR /usr/share/nginx/html

COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /monorepo/frontend/dist ./

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
