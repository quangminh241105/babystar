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

The frontend is available at `http://localhost:3000`. For local development with the Next.js dev server, set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` before starting it. For local Docker Compose, the browser uses the gateway's same-origin `/api/v1` route.

Production CORS defaults to only `https://babystar.qminh.com` and `https://babystar.mom`. The static Render frontend calls the public FastAPI endpoint directly, so `NEXT_PUBLIC_API_URL` must be set at build time and `CORS_ALLOWED_ORIGINS` must include the exact frontend origin. Use `https://api-babystar.qminh.com/api/v1` as the API URL. The frontend and API remain under the same site, so `SESSION_SECURE=true` and `SESSION_SAMESITE=lax` cookies work. The temporary `onrender.com` URL is cross-site and may not retain sessions in browsers that block third-party cookies; use the custom domain for login testing.

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

1. In Render, create a **Static Site** from this repository. Set Branch to `main`, Root Directory to `apps/web`, Build Command to `npm install && npm run build`, and Publish Directory to `out`. Set the build-time environment variable `NEXT_PUBLIC_API_URL` to `https://api-babystar.qminh.com/api/v1`, and use Node 22. There is no Start Command. The `api-babystar.qminh.com` DNS record must route to the existing server's gateway on port `9000`, with HTTPS at the edge.
2. Wait until the Render site URL works. Keep the existing PostgreSQL, Google and API keys in the Jenkins `babystar-env` file credential. Set `CORS_ALLOWED_ORIGINS` to include the Render origin if it will be used directly. The Render service does **not** need database credentials or `GOOGLE_CLIENT_ID`; the browser gets the public client ID from the API.
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
