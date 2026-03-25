# ── Etapa 1: build de React ──────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --silent

COPY . .
RUN npm run build

# ── Etapa 2: nginx sirviendo el build + proxy al backend ─────────────────────
FROM nginx:1.27-alpine

# Copiar el build de Vite
COPY --from=builder /app/dist /usr/share/nginx/html

# Copiar config de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
