# Optional: builds the static site without Node installed, and writes it out as plain files.
#   docker build --build-arg BUILD_COMMIT=$(git rev-parse HEAD) --output type=local,dest=./dist .
# (.git isn't copied in, so the commit is passed as a build arg, and the clean-tree check doesn't run here.)
# You don't need this if you have Node: `npm ci && npm run build` produces the same dist/.
FROM node:22-alpine AS build
ARG BUILD_COMMIT
ENV BUILD_COMMIT=$BUILD_COMMIT
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx vite build

FROM scratch AS dist
COPY --from=build /app/dist /
