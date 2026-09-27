FROM node:22-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json ./
RUN npm install
COPY . ./
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.static.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/out /usr/share/nginx/html
EXPOSE 80
