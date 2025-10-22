ARG NODE_VERSION=24
FROM node:${NODE_VERSION}-bookworm-slim

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto \
    fonts-liberation \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /docs-to-pdf

COPY docs-to-pdf-latest.tgz ./

RUN yarn global add file:/docs-to-pdf/docs-to-pdf-latest.tgz --prefix /usr/local \
    && rm -f docs-to-pdf-latest.tgz
