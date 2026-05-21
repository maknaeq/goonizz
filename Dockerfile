FROM node:25.6.1-alpine3.23

WORKDIR /app

COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/

RUN npm install

CMD ["npm", "run", "dev"]