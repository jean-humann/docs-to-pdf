FROM node:18-alpine

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN apk update && apk upgrade && \
    apk add --no-cache chromium bash font-noto-emoji && \
    rm -rf /usr/include && \
    rm -rf /var/cache/apk/* /root/.node-gyp /usr/share/man /tmp/* 

WORKDIR /docs-to-pdf

COPY docs-to-pdf-latest.tgz ./

RUN yarn global add file:/docs-to-pdf/docs-to-pdf-latest.tgz --prefix /usr/local \
    && rm -f docs-to-pdf-latest.tgz
