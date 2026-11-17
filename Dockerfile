FROM node:20-alpine

WORKDIR /app

# Install app dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy project files
COPY . .

# Expose app port
EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["node", "server.js"]
