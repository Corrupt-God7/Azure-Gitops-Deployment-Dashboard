FROM node:22-alpine AS dependencies
WORKDIR /app
RUN apk add --no-cache bash coreutils dos2unix
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS builder
COPY . .
RUN dos2unix scripts/*.sh
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json /app/package-lock.json ./
EXPOSE 3000
CMD ["npm", "run", "start", "--", "--port", "3000"]