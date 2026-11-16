FROM node:22-bookworm-slim

WORKDIR /app
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci

COPY . .

ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/adapti_quest"
RUN npx prisma generate --schema=./prisma/schema.prisma
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3003

CMD ["npm", "start"]
