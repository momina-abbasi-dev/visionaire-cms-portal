# Visionaire EduCore CMS Portal

Visionaire EduCore is a React and Vite frontend with an Express and MongoDB API.

## Requirements

- Node.js and npm
- MongoDB, either local or hosted

## Configuration

Copy `.env.example` to `.env` in the project root and set `VITE_API_URL` to the API URL used by the frontend.

Copy `backend/.env.example` to `backend/.env`. Set `MONGO_URI` to your MongoDB connection string and replace `JWT_SECRET` with a long, unique random value. Do not commit either `.env` file.

## Run locally

Install dependencies from the project root:

```sh
npm install
```

Start the API from the backend directory so dotenv loads `backend/.env`:

```sh
cd backend
node server.js
```

In another terminal, from the project root, start the frontend:

```sh
npm run dev
```

## Checks

Run these commands from the project root:

```sh
npm test
npm run lint
npm run build
```
