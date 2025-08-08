FROM node:24-alpine AS builder

COPY . /app
WORKDIR /app

RUN npm install
RUN npm run build

FROM node:24-alpine AS release

COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/package-lock.json /app/package-lock.json
COPY --from=builder /app/node_modules /app/node_modules

ENV NODE_ENV=production
WORKDIR /app

ENTRYPOINT ["node", "dist/index.js"]
