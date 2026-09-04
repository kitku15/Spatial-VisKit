FROM node:22-slim

WORKDIR /app

# Copy package first to cache dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your React code (index.html, src/, etc.)
COPY . .

EXPOSE 5173

# Boot up Vite and expose it to the Docker network
CMD ["npm", "run", "dev", "--", "--host"]