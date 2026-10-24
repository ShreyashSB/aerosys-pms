# Builds the API into a small production image.
# Build from the REPO ROOT so the workspace files are visible:
#   docker build -f apps/api/Dockerfile -t aerosys-api .

# ---- 1. build: install every dependency and compile TypeScript to JavaScript
FROM node:22-alpine AS build
RUN npm install -g pnpm@10.28.0
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @aerosys/api
COPY apps/api apps/api
RUN pnpm --filter @aerosys/api build \
 && pnpm --filter @aerosys/api deploy --legacy --prod /out

# ---- 2. runtime: only compiled code, production dependencies and migrations
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./
COPY --from=build /repo/apps/api/dist ./dist
COPY --from=build /repo/apps/api/drizzle ./drizzle
# Run as the unprivileged "node" user that the base image provides.
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
