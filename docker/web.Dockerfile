# Image for the web app: React is built once, then served by nginx.

# ---- 1. Build the React app ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/employee-service/package.json apps/employee-service/
COPY apps/attendance-service/package.json apps/attendance-service/
COPY apps/web/package.json apps/web/
RUN npm ci -w web

COPY apps/web apps/web
RUN npm run build -w web

# ---- 2. nginx serves the files and forwards /api to the services ----
FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
