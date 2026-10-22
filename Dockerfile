# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS build
WORKDIR /app
COPY . .
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
RUN npm run build
RUN npm prune --omit=dev --ignore-scripts

FROM node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df AS runtime
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 ARTIFACT_ROOT=/data/artifacts STUDIO_ROOT=/app/apps/studio/dist/client NODE_USE_ENV_PROXY=1
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps ./apps
COPY --from=build --chown=node:node /app/integrations/node ./integrations/node
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/LICENSE /app/NOTICE ./
RUN mkdir -p /data/artifacts && chown node:node /data/artifacts
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "require('node:http').get({host:'127.0.0.1',port:process.env.PORT||8080,path:'/health/ready',agent:false},r=>{r.resume();process.exitCode=r.statusCode===200?0:1}).on('error',()=>process.exitCode=1)"]
CMD ["node", "apps/server/dist/main.js"]
