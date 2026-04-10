# Playwright + Chromium must live in the image — serverless hosts (e.g. default Vercel) cannot run this app.
# Image tag must match the Playwright npm version in package-lock.json (currently 1.59.x).
FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# Download Chromium build matching the installed Playwright package (cached under /root/.cache/ms-playwright).
RUN npx playwright install chromium

FROM mcr.microsoft.com/playwright:v1.59.1-jammy AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Use bundled Chromium from the cache copied below (no system Chrome in container).
ENV PLAYWRIGHT_CHROMIUM_CHANNEL=
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /root/.cache/ms-playwright /root/.cache/ms-playwright

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
