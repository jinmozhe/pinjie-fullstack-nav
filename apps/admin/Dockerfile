FROM node:24-alpine@sha256:d32cdf619f63fe0471182d08996dd516c6275bb5fd31ae06e55a570bd9e1ad43 AS build

WORKDIR /workspace
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .pnpmfile.cjs ./
COPY apps/admin/package.json apps/admin/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api-client/package.json packages/api-client/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY patches patches
RUN pnpm install --frozen-lockfile
COPY packages packages
COPY apps/admin apps/admin
RUN pnpm --filter @pinjie/admin build

FROM nginx:1.29-alpine@sha256:5616878291a2eed594aee8db4dade5878cf7edcb475e59193904b198d9b830de AS runtime
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/admin/dist /usr/share/nginx/html
RUN apk upgrade --no-cache \
    && sed -i 's#^pid .*;#pid /tmp/nginx.pid;#' /etc/nginx/nginx.conf \
    && chown -R nginx:nginx /var/cache/nginx /var/log/nginx /usr/share/nginx/html
USER nginx
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=6 CMD ["wget", "--quiet", "--spider", "http://127.0.0.1:3001/healthz"]
