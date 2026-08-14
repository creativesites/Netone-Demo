FROM node:20-slim

WORKDIR /app

# Baileys pulls its `libsignal` dependency directly from a git URL at install
# time (not the npm registry). node:20-slim ships no `git`, which fails with
# "npm error syscall spawn git ENOENT". Install git, and force any ssh://
# GitHub URL to be rewritten to https:// — avoids needing an SSH key and
# avoids a hang/failure if outbound port 22 is firewalled.
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && git config --global url."https://github.com/".insteadOf "ssh://git@github.com/" \
    && rm -rf /var/lib/apt/lists/*

# Install deps first for layer caching. Uses the committed lockfile for a
# reproducible, deterministic install (pins the exact libsignal-node commit).
COPY package*.json ./
RUN npm ci --omit=dev

# App source
COPY index.js ./

# Session credentials live here and are mounted as a volume for persistence.
ENV SESSION_DIR=/app/session
ENV PORT=4703
EXPOSE 4703

CMD ["node", "index.js"]
