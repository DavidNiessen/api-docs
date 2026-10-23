# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim@sha256:55fb5f5a527ea2c5c4a95f963e48ef90aa38c7b346054fdc8ee9957a2b55d205 AS build
WORKDIR /app
COPY . .
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true \
    && npm run build \
    && npm prune --omit=dev --ignore-scripts --offline --no-audit --no-fund

FROM node:24.22.1-alpine3.24@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS runtime
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 ARTIFACT_ROOT=/data/artifacts STUDIO_ROOT=/app/apps/studio/dist/client NODE_USE_ENV_PROXY=1
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages ./packages
COPY --from=build --chown=node:node /app/apps ./apps
COPY --from=build --chown=node:node /app/integrations/node ./integrations/node
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json /app/LICENSE /app/NOTICE ./
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-* \
      /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && mkdir -p /data/artifacts && chown node:node /data/artifacts
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "-e", "require('node:http').get({host:'127.0.0.1',port:process.env.PORT||8080,path:'/health/ready',agent:false},r=>{r.resume();process.exitCode=r.statusCode===200?0:1}).on('error',()=>process.exitCode=1)"]
CMD ["node", "apps/server/dist/main.js"]

# Operator-selected offline build worker. The caller supplies all runtime limits.
FROM runtime AS isolated-builder
USER root
RUN mkdir -p /work && ln -s /app/node_modules /work/node_modules
USER node
CMD ["node", "-e", "setInterval(()=>{},1000)"]

# Preserve the server distribution as the default build target.
FROM runtime AS server
