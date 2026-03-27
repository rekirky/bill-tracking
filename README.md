# BillTracker

A self-hosted household bill tracking portal. Built with FastAPI + React, containerised with Docker.

## Prerequisites

- Docker & Docker Compose installed
- Port `3000` (frontend) and `8000` (backend) free on your host

## Quick start

```bash
# 1. Clone / unzip this folder
cd billtracker

# 2. Build and start
docker compose up --build -d

# 3. Open in your browser
http://localhost:3000
```

The SQLite database is stored in a Docker volume (`db_data`) and persists across restarts.

## First-time setup

1. Go to **Accounts** and add your bank accounts (e.g. BWB, BWG, ANZ).
   - Mark your main bills savings account as **Primary bills account**.
2. Go to **Dashboard** and start adding bills.
3. As you transfer money to your bills account, use the **＋** button on each bill to log money aside.
4. When a bill is paid, use the **✓** button — it will auto-calculate the next due date for recurring bills.
5. Use **Reconcile** to compare your actual bank balance against your system total.

## Development (local, without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Frontend dev server runs on `http://localhost:5173` and proxies `/api` to the backend at `localhost:8000`.

## Cloudflare Zero Trust

Place this app behind Cloudflare Zero Trust for access control. No authentication is built into the app itself.

Recommended tunnel config:
- Frontend: `http://localhost:3000` → your public hostname
- The nginx reverse proxy inside the frontend container handles routing `/api/*` to the backend.

## Tech stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy, SQLite, python-dateutil
- **Frontend**: React 18, Vite, React Router, DM Sans / DM Serif Display / DM Mono
- **Infrastructure**: Docker Compose, nginx

## Frequency options

| Value | Offset |
|-------|--------|
| `once` | No recurrence |
| `fortnightly` | +14 days |
| `monthly` | +1 calendar month |
| `quarterly` | +3 calendar months |
| `six_monthly` | +6 calendar months |
| `annually` | +1 calendar year |
