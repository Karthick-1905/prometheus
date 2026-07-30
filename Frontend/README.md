# CAT Smart Rental — Frontend

Vite + React SPA (migrated from Next.js `src/app`).

## Setup

```powershell
cd Frontend
npm install
npm run dev
```

Open http://localhost:5173

Dev proxy: `/api/*` → `http://localhost:8000` (FastAPI backend).

Optional: set `VITE_API_URL=http://localhost:8000` to call the API without proxy.

## Pages

- `/` — Fleet dashboard, alerts, telemetry simulator
- `/ml-lab` — Isolation Forest feature lab
