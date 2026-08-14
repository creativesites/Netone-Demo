FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
# schema.sql is read at runtime by the migration step.
COPY src/db/schema.sql ./dist/db/schema.sql
EXPOSE 4702
ENV BACKEND_PORT=4702
CMD ["node", "dist/server.js"]
