FROM node:22-alpine AS build
WORKDIR /app

COPY package.json ./package.json
COPY server/package.json ./server/package.json
COPY client/package.json ./client/package.json
RUN npm install --workspace server --workspace client --include-workspace-root

COPY server ./server
COPY client ./client

RUN npm run generate --workspace server
RUN npm run build --workspace client

FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache nginx gettext

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server ./server
COPY --from=build /app/client/dist /usr/share/nginx/html

RUN mkdir -p /etc/nginx/templates /etc/nginx/conf.d
RUN cat > /etc/nginx/templates/default.conf.template <<'EOF'
server {
    listen ${PORT};
    server_name _;

    root /usr/share/nginx/html;
    index index.html;

    location /assets/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    location = /index.html {
        add_header Cache-Control "no-store, must-revalidate";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:4000;
    }

    location / {
        add_header Cache-Control "no-store, must-revalidate";
        try_files $uri /index.html;
    }
}
EOF

EXPOSE 4000

CMD sh -c "cd /app/server && npx prisma migrate deploy && PORT=4000 node src/index.js & envsubst '\$PORT' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"
