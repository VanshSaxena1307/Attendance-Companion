# Attendance Companion

Attendance Companion is a pnpm workspace containing a Vite/React frontend and an Express API.
The checked-in demo uses in-memory data, so no database or credentials are needed for local development.

## Run locally on Windows

```powershell
cd C:\Users\vansh\OneDrive\Desktop\Attendance-Companion
pnpm install
pnpm dev
```

Open `http://localhost:5173`. The API runs on `http://localhost:5000`; the Vite
development server proxies `/api` to it, including demo session cookies.

## Demo login

The login page has no password field. Select a role and choose **Enter demo
workspace**. It maps to these seeded accounts:

- Student: `vansh@attendance.edu` (Vansh Saxena)
- Mentor: `priya.nair@attendance.edu` (Priya Nair)
- HOD: `rajesh.mehta@attendance.edu` (Rajesh Mehta)

The API also provides `aman@attendance.edu` as a second seeded student and
`admin@attendance.edu` through `POST /api/auth/demo-login` with `{ "role": "ADMIN" }`.

## Environment

No variables are required in demo mode. See `.env.example` for optional local
overrides. Set a strong `SESSION_SECRET` for production or any shared deployment.

`DATABASE_URL` is required only by Drizzle commands such as
`pnpm --filter @workspace/db run push`; the running demo API does not import or
query PostgreSQL.

## Verification commands

```powershell
pnpm run typecheck
pnpm run build
```
