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

The frontend is available at `http://localhost:3000`. During local development, set `API_ORIGIN` if the API is not running at `http://localhost:8000`.

Production CORS defaults to only `https://babystar.qminh.com` and `https://babystar.mom`. The Render frontend keeps browser API requests on `/api/v1`; Next.js proxies them to the backend through its server-side `API_ORIGIN` setting. This keeps session cookies first-party, so `SESSION_SECURE=true` and `SESSION_SAMESITE=lax` can remain in production. Add the exact Render URL to `CORS_ALLOWED_ORIGINS` if users will access that URL directly. Do not set `NEXT_PUBLIC_API_URL` to a different origin unless you deliberately want cross-site cookies and the associated browser restrictions.

Google sign-in uses the public `GOOGLE_CLIENT_ID` from the API environment. Add the production domains (and any Render/Vercel frontend origin) to the Google OAuth client's authorized JavaScript origins. The frontend reads the configured client ID from `/api/v1/auth/google/config`; the client secret is never exposed.

The verified Google account `phamlequangminh2411@gmail.com` receives the admin role on Google sign-in and is sent to `/admin`. If that email had a password account, its password and previous sessions are removed on promotion so admin access uses Google authentication. Admin API routes still enforce the role server-side.

The admin dashboard can create one batch of 500 inactive Vietnamese demo accounts, each with a pregnancy profile and health log. Accounts are tagged with `auth_provider=demo` and a reserved `.invalid` email domain; the remove action deletes only those tagged accounts and their records. The EN/VI and light/dark choices are stored in the browser.

## Run with Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The complete stack is then available at `http://localhost:9000` through the reverse proxy. Compose starts PostgreSQL, FastAPI, the weekly/reminder worker, Next.js, and Nginx. The database is a fresh PostgreSQL schema; no MongoDB migration is run automatically.

For local HTTP testing, change `SESSION_SECURE=false` and set `CORS_ALLOWED_ORIGINS=http://localhost:9000` in `.env`. Keep `SESSION_SECURE=true` for HTTPS production deployments.

## Production deployment: Render web + Jenkins backend

1. Create a Render **Node web service** from [render.yaml](render.yaml). Set its `API_ORIGIN` to the public HTTPS backend origin, for example `https://api.babystar.qminh.com` (no `/api/v1` suffix). Render builds and deploys `apps/web` directly; it does not use Docker. The public API host must route `/api/v1/*` to the existing server's gateway on port `9000`, with HTTPS at the edge. Do not point `API_ORIGIN` to the frontend hostname, or the rewrite will loop.
2. Wait until the Render service URL works. In the Jenkins `babystar-env` file credential, set `RENDER_WEB_ORIGIN=https://<your-service>.onrender.com`, with no path or trailing slash. Keep the existing PostgreSQL, Google and API keys there. Add the Render origin to `CORS_ALLOWED_ORIGINS` if it will be used directly. The Render service does **not** need database credentials or `GOOGLE_CLIENT_ID`; the browser gets the public client ID from the API.
3. Deploy the backend with Jenkins. It now validates only FastAPI, builds only API/worker containers, verifies Render first, then switches the port-9000 gateway to the new API color and proxies web requests to Render. If Render is not configured or unavailable, the rollout stops before touching the running deployment. The previous API color remains until gateway health checks pass.
4. Add `https://babystar.qminh.com` and the Render URL to the Google OAuth client's authorized JavaScript origins if both will be used. When ready, point the frontend domain to Render; the gateway's Render proxy also keeps the old webserver routing working during DNS propagation. Ensure the separate API hostname still routes to the backend. HTTPS is required for secure session cookies.

The deployment host must provide Docker access to the Jenkins deploy user. Local `docker compose up --build` remains available for development; it is not the production frontend deployment path.

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
