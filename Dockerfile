# ---- Frontend build stage ----
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install
COPY . .
# API base URL is baked in at build time
ARG VITE_API_BASE=/api
ENV VITE_API_BASE=$VITE_API_BASE
RUN bun run build

# ---- Runtime: nginx ----
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget -q --spider http://localhost/ || exit 1
