FROM node:22-alpine

WORKDIR /app

# Install backend dependencies
COPY package*.json ./
RUN npm install --production

# Install and build frontend
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Copy backend source
COPY app.js ./
COPY src/ ./src/

# Data volume for SQLite
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 1995

ENV NODE_ENV=production
ENV PORT=1995

CMD ["node", "app.js"]
