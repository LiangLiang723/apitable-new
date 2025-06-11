ARG IMAGE_TAG=latest

FROM apitable-backend-server:1.10.3 as backend-server
FROM apitable-room-server:1.10.3  as room-server
FROM apitable-web-server:1.10.3 as web-server
FROM apitable/init-db:${IMAGE_TAG} as init-db

FROM apitable/databus-server:latest as databus-server
FROM apitable/init-appdata:latest as init-appdata
FROM apitable/imageproxy-server:latest as imageproxy-server

FROM apitable/dataenv-liquibase-pm2:latest

COPY --from=backend-server /app/ /app/backend-server/
COPY --from=databus-server /usr/local/bin/ /app/databus-server/
COPY --from=room-server /app/ /app/room-server/
COPY --from=web-server /app/ /app/web-server/
COPY --from=imageproxy-server /app/ /app/imageproxy-server/
COPY --from=init-db /liquibase/changelog/ /liquibase/changelog/
COPY --from=init-appdata /app/ /app/init-appdata/

RUN set -euxo pipefail; \
  curl -LO https://github.com/Automattic/node-canvas/releases/download/v2.9.1/canvas-v2.9.1-node-v93-linux-glibc-x64.tar.gz; \
  tar -xzf canvas-v2.9.1-node-v93-linux-glibc-x64.tar.gz; \
  rm -rf /app/web-server/node_modules/.pnpm/node_modules/canvas/build/Release; \
  mv Release /app/web-server/node_modules/.pnpm/node_modules/canvas/build/; \
  rm -f canvas-v2.9.1-node-v93-linux-glibc-x64.tar.gz

COPY gateway/conf.d/ /etc/nginx/conf.d/

RUN set -euxo pipefail; \
    sed -i 's| /dev/stdout ||' /etc/nginx/conf.d/default.conf; \
    sed -i 's/\<8080\>/3000/' /etc/nginx/conf.d/upstream/ups-web-server.conf

COPY packaging/all-in-one/all-in-one/script/add-host.sh /usr/local/bin/
COPY packaging/all-in-one/all-in-one/script/init-appdata.sh /usr/local/bin/

COPY packaging/all-in-one/all-in-one/ecosystem.config.js /

CMD ["bash", "-c", "init-dataenv.sh && add-host.sh && pm2-runtime start ecosystem.config.js"]

ARG SEMVER_FULL
ENV SEMVER_FULL=${SEMVER_FULL}

ENV BACKEND_BASE_URL=http://backend-server:8081/api/v1/
ENV ROOM_GRPC_URL=0.0.0.0:3334
ENV SOCKET_GRPC_URL=0.0.0.0:3007
ENV DATABUS_SERVER_BASE_URL=http://databus-server:8625
ENV OSS_CACHE_TYPE=minio
ENV OSS_HOST=assets
ENV OSS_TYPE=QNY1
ENV MINIO_ACCESS_KEY=apitable
ENV MINIO_SECRET_KEY=apitable@com
ENV DATABASE_TABLE_PREFIX=apitable_
ENV MYSQL_DATABASE=apitable
ENV MYSQL_HOST=mysql
ENV MYSQL_PASSWORD=apitable@com
ENV MYSQL_PORT=3306
ENV MYSQL_ROOT_PASSWORD=apitable@com
ENV MYSQL_USERNAME=root
ENV REDIS_DB=0
ENV REDIS_HOST=redis
ENV REDIS_PASSWORD=apitable@com
ENV REDIS_PORT=6379
ENV RABBITMQ_HOST=rabbitmq
ENV RABBITMQ_PASSWORD=apitable@com
ENV RABBITMQ_PORT=5672
ENV RABBITMQ_USERNAME=apitable
ENV RABBITMQ_VHOST=/
ENV TIMEZONE=Asia/Singapore
ENV ENV=apitable
ENV API_PROXY=http://backend-server:8081
ENV BACKEND_INFO_URL=http://backend-server:8081/api/v1/client/info
ENV PUBLIC_URL=
ENV TEMPLATE_PATH=./static/web_build/index.html
ENV USE_CUSTOM_PUBLIC_FILES=true
ENV NEST_GRPC_ADDRESS=static://room-server:3334
ENV CALLBACK_DOMAIN=
ENV CORS_ORIGINS=*
ENV SERVER_DOMAIN=
ENV SOCKET_DOMAIN=http://room-server:3333/socket
ENV SKIP_REGISTER_VALIDATE=true
ENV TEMPLATE_SPACE=spcNTxlv8Drra
ENV SOCKET_RECONNECTION_ATTEMPTS=10
ENV SOCKET_RECONNECTION_DELAY=500
ENV SOCKET_TIMEOUT=5000
ENV SOCKET_URL=http://room-server:3002
ENV SMS_ENABLED=false
ENV MAIL_ENABLED=false
ENV MAIL_FROM=
ENV MAIL_HOST=
ENV MAIL_PASSWORD=
ENV MAIL_PORT=
ENV MAIL_SSL_ENABLE=true
ENV MAIL_TYPE=smtp
ENV MAIL_USERNAME=
ENV OSS_CLIENT_TYPE=aws
ENV OSS_ENABLED=true
ENV AWS_ACCESS_KEY=apitable
ENV AWS_ACCESS_SECRET=apitable@com
ENV AWS_ENDPOINT=http://minio:9000
ENV AWS_REGION=us-east-1
ENV ASSETS_BUCKET=assets
ENV ASSETS_URL=assets
ENV OSS_BUCKET_NAME=assets
