FROM node:22-bullseye-slim AS builder
WORKDIR /app

# Prisma's config loader expects a DATABASE_URL at build time.
# This is only used to parse/generate the client; the real value is injected at runtime.
ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
ENV DATABASE_URL=${DATABASE_URL}

# Install all deps (including dev deps for build)
COPY package*.json ./
RUN npm install --include=dev

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Remove dev dependencies to keep runtime image small
RUN npm prune --omit=dev

FROM node:22-bullseye-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only production artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
CMD ["npm", "start"]
