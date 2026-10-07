# ======= STAGE 1: Build =======
FROM node:22-alpine AS build

# Diretório de trabalho
WORKDIR /app/s4-extensao-dotz-api

# Copia package.json e package-lock.json
COPY package*.json ./

# Instala dependências com cache reprodutível
RUN npm ci

# Copia todo o código
COPY . .

# Gera Prisma clients
RUN npm run prisma:generate

# Compila o TypeScript para dist/
RUN npm run build



# ======= STAGE 2: Runtime (Production) =======
FROM node:22-alpine AS production

WORKDIR /app/s4-extensao-dotz-api

ENV NODE_ENV=production

# Copia arquivos necessários do build
COPY --from=build /app/s4-extensao-dotz-api/dist ./dist
COPY --from=build /app/s4-extensao-dotz-api/node_modules ./node_modules
COPY --from=build /app/s4-extensao-dotz-api/package.json ./package.json
COPY --from=build /app/s4-extensao-dotz-api/prisma ./prisma
COPY --from=build /app/s4-extensao-dotz-api/assets ./assets

EXPOSE 5858

CMD ["npm", "run", "start"]
