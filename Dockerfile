FROM node:alpine

WORKDIR /app

# No npm install needed as we have no dependencies!
# Just copy the source code
COPY . .

# Expose the port the server runs on
EXPOSE 3000

# Set environment variables if needed
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]
