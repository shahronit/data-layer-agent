# Playwright + Chromium must live in the image — serverless hosts (e.g. default Vercel) cannot run this app.
# Image tag must match the Playwright npm version in package-lock.json (currently 1.59.x).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
# Install browsers here (full node_modules from npm ci). Next standalone does not ship playwright's CLI.
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers

RUN apt-get update && apt-get install -y python3 build-essential && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Next standalone expects ./public beside server.js; repo may omit the folder — ensure it exists for COPY.
RUN mkdir -p public
RUN npm run build

# --force ensures binaries land under PLAYWRIGHT_BROWSERS_PATH (base image may skip default cache paths).
RUN mkdir -p /ms-playwright-browsers \
  && npx playwright install chromium --force

FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PLAYWRIGHT_CHROMIUM_CHANNEL=
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright-browsers
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /ms-playwright-browsers /ms-playwright-browsers
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3

RUN mkdir -p /app/data/screenshots && chmod -R a+rwx /app/data
RUN chmod -R a+rx /ms-playwright-browsers

EXPOSE 3000

CMD ["node", "server.js"]
