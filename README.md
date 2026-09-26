# BabyStar

BabyStar is a pregnancy companion rebuilt as a Next.js frontend, FastAPI backend, and PostgreSQL application. It includes account sessions, pregnancy profiles, daily health logs, weekly reports, nutrition and exercise plans, partner sharing, chat, quizzes, notifications, nearby healthcare search, and an admin surface.

## Run locally

### API

```powershell
cd apps/api
python -m pip install -r requirements.txt
$env:DATABASE_URL = "sqlite:///./babystar.db"   # use PostgreSQL for production
$env:CORS_ALLOWED_ORIGINS = "http://localhost:3000"
uvicorn app.main:app --reload
```

The API is available at `http://localhost:8000`, with OpenAPI docs at `/docs`.

### Web

```powershell
cd apps/web
npm install
npm run dev
```

The frontend is available at `http://localhost:3000`. During local development, set `API_INTERNAL_URL` if the API is not running at `http://localhost:8000`.

Production CORS defaults to only `https://babystar.qminh.com` and `https://babystar.mom`. For a separately hosted Render or Vercel frontend, set `CORS_ALLOWED_ORIGINS` to its exact HTTPS URL, set `NEXT_PUBLIC_API_URL` to the API's public `/api/v1` URL, and use `SESSION_SECURE=true` with `SESSION_SAMESITE=none` for cross-site cookie sessions.

## Run with Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The complete stack is then available at `http://localhost:9000` through the reverse proxy. Compose starts PostgreSQL, FastAPI, the weekly/reminder worker, Next.js, and Nginx. The database is a fresh PostgreSQL schema; no MongoDB migration is run automatically.

For local HTTP testing, change `SESSION_SECURE=false` and set `CORS_ALLOWED_ORIGINS=http://localhost:9000` in `.env`. Keep `SESSION_SECURE=true` for HTTPS production deployments.

Useful commands:

```powershell
docker compose logs -f api
docker compose exec api alembic upgrade head
docker compose down
```

## Verification

```powershell
cd apps/api
pytest
python -m compileall -q app alembic tests

cd ../web
npm run build
```

The original `server/` and `client/` directories are retained for reference and controlled cutover. The new Compose runtime does not depend on the legacy MongoDB application.
