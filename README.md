# Visionaire EduCore — CMS Portal

A full-stack educational management portal built with the MERN stack to organize academic operations, manage users, and streamline institutional workflows through role-based dashboards.

> **Project Status:** In Development

## Overview

Visionaire EduCore is an educational management system designed to bring essential academic and administrative operations into one centralized platform.

The application provides dedicated dashboards for administrators, teachers, and students, with role-based access to relevant features and workflows.

## Key Features

### Admin Dashboard
- Overview of institutional activities and system statistics
- User, student, and teacher management
- Department, program, class, and subject management
- Academic session and teacher assignment management
- Admission review and management
- Fee challans, payments, discounts, and financial records
- Academic record and result management

### Teacher Dashboard
- View assigned classes and subjects
- Access student information
- Manage attendance
- Submit academic records and marks
- Access teaching-related academic workflows

### Student Dashboard
- View personal profile and academic information
- Check attendance and eligibility
- Access academic records and results
- View fee status and payment history

## Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React, Vite, JavaScript |
| Styling | CSS |
| Backend | Node.js, Express.js |
| Database | MongoDB, Mongoose |
| Authentication | JWT, bcrypt |
| API Communication | Axios |
| Testing | Node.js Test Runner, MongoDB Memory Server |

## Project Structure

```text
CMS Portal/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── tests/
│   └── server.js
├── public/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── layouts/
│   ├── pages/
│   ├── routes/
│   ├── services/
│   ├── styles/
│   └── utils/
├── .env.example
├── backend/.env.example
└── package.json
```

## Getting Started

### Requirements

- Node.js and npm
- MongoDB (local instance or hosted database)

### Installation

Clone the repository:

```bash
git clone https://github.com/momina-abbasi-dev/visionaire-cms-portal.git
cd visionaire-cms-portal
```

Install frontend dependencies:

```bash
npm install
```

### Configuration

Create a root `.env` file using `.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

Create `backend/.env` using `backend/.env.example` and configure:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_unique_random_secret
```

Replace the placeholder values with your own configuration. Never commit environment files containing secrets.

### Run the Application

Start the backend from the backend directory:

```bash
cd backend
node server.js
```

In a separate terminal, from the project root, start the frontend:

```bash
npm run dev
```

Open the local URL displayed by Vite in your browser.

## Available Checks

Run these commands from the project root:

```bash
npm test
npm run lint
npm run build
```

## Development Status

The project is actively being developed. Core dashboard workflows and backend functionality have been implemented, while testing, interface refinement, and additional improvements are ongoing.

It is currently a development project and is not presented as a production-ready deployment.

## Repository

[GitHub — Visionaire CMS Portal](https://github.com/momina-abbasi-dev/visionaire-cms-portal)
