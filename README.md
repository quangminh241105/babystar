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

Production CORS defaults to `https://babystar.qminh.com` and `https://babystar.mom`. The host frontend uses the same-origin `/api/v1` gateway route. The Render copy also uses `/api/v1`, with a Render rewrite proxying that path to `https://api-babystar.qminh.com/api/v1`; add the exact Render site origin to `CORS_ALLOWED_ORIGINS` in Jenkins `babystar-env`. The rewrite keeps API calls and session cookies on each frontend's own origin. Keep `SESSION_SECURE=true` and `SESSION_SAMESITE=lax` for HTTPS production.

Google sign-in uses the public `GOOGLE_CLIENT_ID` from the API environment. Add `https://babystar.qminh.com` and the Render site's exact `onrender.com` origin to the Google OAuth client's authorized JavaScript origins. The frontend reads the configured client ID from `/api/v1/auth/google/config`; the client secret is never exposed.

The verified Google account `phamlequangminh2411@gmail.com` receives the admin role on Google sign-in and is sent to `/admin`. If that email had a password account, its password and previous sessions are removed on promotion so admin access uses Google authentication. Admin API routes still enforce the role server-side.

The admin dashboard can create one batch of 500 inactive Vietnamese demo accounts, each with a pregnancy profile and health log. Accounts are tagged with `auth_provider=demo` and a reserved `.invalid` email domain; the remove action deletes only those tagged accounts and their records. The EN/VI and light/dark choices are stored in the browser.

## Run with Docker Compose

```powershell
Copy-Item .env.example .env
docker compose up --build
```

The complete stack is then available at `http://localhost:9000` through the reverse proxy. Compose starts PostgreSQL, FastAPI, the weekly/reminder worker, Next.js, and Nginx. The database is a fresh PostgreSQL schema; no MongoDB migration is run automatically.

For local HTTP testing, change `SESSION_SECURE=false` and set `CORS_ALLOWED_ORIGINS=http://localhost:9000` in `.env`. Keep `SESSION_SECURE=true` for HTTPS production deployments.

## Production deployment: host server and Render

Jenkins and Docker run on the application host. Jenkins copies the checked-out files to `/opt/webapps/babystar` and runs the deployment locally; there is no SSH target address in the pipeline. The Jenkins controller executor must have write access to that directory and Docker access. The blue/green API and web containers alternate together; Nginx switches traffic on port `9000` after both services pass health checks. The previous color remains available until the new color is healthy. Point `babystar.qminh.com` to the host's HTTPS reverse proxy.

The Render Static Site remains available as a second frontend. Configure it with Branch `main`, Root Directory `apps/web`, Build Command `npm install && npm run build`, Publish Directory `out`, and build environment variable `NEXT_PUBLIC_API_URL=/api/v1`. Add this rewrite in the Render dashboard under Redirects/Rewrites (then redeploy Render):

| Source | Destination | Action |
| --- | --- | --- |
| `/api/*` | `https://api-babystar.qminh.com/api/*` | Rewrite |

Point `api-babystar.qminh.com` to the host's HTTPS gateway (port `9000`). In Jenkins `babystar-env`, set `CORS_ALLOWED_ORIGINS` to `https://babystar.qminh.com,https://babystar.mom,https://<your-render-site>.onrender.com`, replacing the last value with the exact Render origin. Add both frontend origins to the Google OAuth client's authorized JavaScript origins if Google login should work on both sites.

The deployment host must provide Docker access to the Jenkins deploy user. Local `docker compose up --build` remains available for development.

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
