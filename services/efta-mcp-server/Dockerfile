# ─── Build stage ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install build deps for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npx tsc

# ─── Runtime stage ────────────────────────────────────────────────────────
FROM node:22-slim

WORKDIR /app

# Runtime deps for better-sqlite3
RUN apt-get update && apt-get install -y curl gzip && rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY data/download.sh ./data/download.sh

# Data directory — mount a Railway volume here
ENV CORPUS_DATA_DIR=/data
ENV PORT=3001

EXPOSE 3001

# Startup: download databases if missing, then start server
CMD ["sh", "-c", "if [ ! -f /data/full_text_corpus.db ]; then echo 'Downloading corpus databases...' && cd /data && bash download.sh; fi && node build/index.js"]
