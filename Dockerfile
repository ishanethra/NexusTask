FROM node:18-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Expose the port
EXPOSE 3000

ENV NODE_ENV=production

CMD ["node", "server/index.js"]
