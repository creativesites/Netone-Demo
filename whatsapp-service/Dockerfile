FROM node:20-slim

WORKDIR /app

# Install deps first for layer caching
COPY package*.json ./
RUN npm install --omit=dev

# App source
COPY index.js ./

# Session credentials live here and are mounted as a volume for persistence.
ENV SESSION_DIR=/app/session
ENV PORT=3000
EXPOSE 3000

CMD ["node", "index.js"]
