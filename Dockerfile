FROM node:20 AS build-env

WORKDIR /app

COPY package.json .
COPY yarn.lock .
RUN yarn install --frozen-lockfile --network-timeout 1000000

COPY . .
RUN yarn build

FROM node:20 AS runtime-env

WORKDIR /app

COPY --from=build-env /app/package.json .
COPY --from=build-env /app/yarn.lock .
COPY --from=build-env /app/dist ./dist

RUN yarn --frozen-lockfile install --production --network-timeout 1000000

LABEL org.opencontainers.image.source=https://github.com/pipip/untis-ics-sync

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/health').then(r=>{if(r.status!==200)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
