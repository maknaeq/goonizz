FROM node:25.6.1-alpine3.23

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm i

EXPOSE 3000

COPY tsconfig.json ./
COPY src ./src

CMD sh -c "npm run dev"