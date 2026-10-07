# Matches the playwright version in package.json so the preinstalled browser matches.
FROM mcr.microsoft.com/playwright:v1.63.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["node", "run-bot-forever.js"]
