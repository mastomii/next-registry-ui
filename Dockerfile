# ===============================================
# Stage 1: Dependencies (cached layer)
# ===============================================
FROM node:20-alpine AS deps
WORKDIR /app

# Install dependencies needed for node-gyp
RUN apk add --no-cache libc6-compat

# Copy only package files for dependency caching
COPY package.json package-lock.json* ./

# Install dependencies with clean cache
RUN npm ci --legacy-peer-deps && npm cache clean --force

# ===============================================
# Stage 2: Builder
# ===============================================
FROM node:20-alpine AS builder
WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set production environment for build optimizations
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# ===============================================
# Stage 3: Production (minimal runtime)
# ===============================================
FROM node:20-alpine AS runner
WORKDIR /app

LABEL authors="me@mastomi.id"

# Set production environment
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install only runtime dependencies
RUN apk add --no-cache tzdata curl \
    && cp /usr/share/zoneinfo/Asia/Jakarta /etc/localtime \
    && echo "Asia/Jakarta" > /etc/timezone \
    && apk del tzdata

# Create non-root user for security
RUN addgroup --system --gid 1337 nodejs \
    && adduser --system --uid 1337 nextjs

# Copy only necessary files from builder
# 1. Standalone server (includes all bundled dependencies)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 2. Static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose port
EXPOSE 3000

# Set hostname for container
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/ || exit 1

# Start the standalone server (much faster than npm start)
CMD ["node", "server.js"]