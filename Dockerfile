# Optional: builds the static site without Node installed, and writes it out as plain files.
#   docker build --output type=local,dest=./dist .
# You don't need this if you have Node: `npm ci && npm run build` produces the same dist/.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM scratch AS dist
COPY --from=build /app/dist /
