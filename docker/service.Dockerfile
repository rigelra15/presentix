# Image for one backend service.
# SERVICE is "employee-service" or "attendance-service" (set in compose.yaml).

# ---- 1. Build the TypeScript code ----
FROM node:22-alpine AS build
ARG SERVICE
WORKDIR /app

# npm workspaces need every package.json that is listed in the lockfile
COPY package.json package-lock.json ./
COPY apps/employee-service/package.json apps/employee-service/
COPY apps/attendance-service/package.json apps/attendance-service/
COPY apps/web/package.json apps/web/
RUN npm ci -w ${SERVICE}

COPY apps/${SERVICE} apps/${SERVICE}
RUN npm run build -w ${SERVICE}

# ---- 2. Small image that only runs the built code ----
FROM node:22-alpine
ARG SERVICE
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/employee-service/package.json apps/employee-service/
COPY apps/attendance-service/package.json apps/attendance-service/
COPY apps/web/package.json apps/web/
RUN npm ci -w ${SERVICE} --omit=dev && npm cache clean --force

# Source is copied only for the helper scripts (seed, create-hrd).
# --chown: the app runs as the "node" user and must be able to read them.
COPY --chown=node:node apps/${SERVICE} apps/${SERVICE}
COPY --chown=node:node --from=build /app/apps/${SERVICE}/dist apps/${SERVICE}/dist

ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app/apps/${SERVICE}
USER node

# Apply new migrations, then start the service
CMD ["sh", "-c", "npm run migration:run && node dist/main.js"]
