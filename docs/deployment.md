# Deployment Guide

> Generated: 2026-06-07 | Confidence: MEDIUM (inferred from config files — no deployment scripts found)

## Architecture

```
                   ┌──────────────┐
                   │   Browser    │
                   └──────┬───────┘
                          │ HTTPS
                   ┌──────▼───────┐
                   │  nginx/CDN   │
                   │  (reverse    │
                   │   proxy)     │
                   └──┬──────┬────┘
            /api/*    │      │    static files
         ┌────────────▼┐  ┌──▼───────────┐
         │  FastAPI     │  │  Static File  │
         │  (gunicorn   │  │  Server       │
         │   + uvicorn) │  │  (dist/)      │
         └──────┬───────┘  └───────────────┘
                │
         ┌──────▼───────┐
         │  Oracle DB    │
         └──────────────┘
```

---

## Backend Deployment

### Prerequisites

- Python 3.10+
- Oracle DB access (network + credentials)
- Production `.env` configuration

### Production `.env`

```env
SECRET_KEY=<cryptographically-random-64-char-string>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=120
ORACLE_HOST=<production-oracle-host>
ORACLE_PORT=1521
ORACLE_SERVICE=<production-service-name>
ORACLE_USERNAME=<production-user>
ORACLE_PASSWORD=<production-password>
CORS_ORIGINS=https://your-frontend-domain.com
```

### Option A: Gunicorn + Uvicorn Workers

```bash
cd backend
uv sync --no-dev  # Production install (no dev dependencies)

# Run with 4 workers
uv run gunicorn app.main:app \
  -w 4 \
  -k uvicorn.workers.UvicornWorker \
  --bind 0.0.0.0:8000 \
  --access-logfile - \
  --error-logfile -
```

### Option B: Uvicorn with Multiple Workers

```bash
uv run uvicorn app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers 4
```

### Option C: Docker (Suggested)

A Dockerfile is NOT included in the repository. Below is a recommended approach:

```dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY backend/ .

RUN pip install uv && uv sync --no-dev

EXPOSE 8000
CMD ["uv", "run", "gunicorn", "app.main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

---

## Frontend Deployment

### Production Build

```bash
cd frontend
npm run build
```

Output goes to `frontend/dist/`. These are static files (HTML, JS, CSS) that can be served by any static file server.

### Option A: Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend static files
    root /path/to/frontend/dist;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy to backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /auth/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }
}
```

### Option B: Serve with Vite Preview (Testing Only)

```bash
cd frontend
npm run build
npm run preview  # Serves dist/ on port 4173
```

---

## Pre-Deployment Checklist

### Critical (Must Do)

- [ ] Change `SECRET_KEY` to a cryptographically random value
- [ ] Set `CORS_ORIGINS` to specific frontend domain (not `*`)
- [ ] Remove `Base.metadata.create_all()` from lifespan (use Alembic)
- [ ] Set secure environment variables (not hardcoded defaults)
- [ ] Enable HTTPS

### Recommended

- [ ] Add rate limiting to login endpoint
- [ ] Configure proper logging (replace `print()` statements)
- [ ] Set up monitoring/health checks
- [ ] Configure connection pool size for expected load
- [ ] Add `pool_recycle` to prevent Oracle idle timeout
- [ ] Set up database backups
- [ ] Configure firewall rules for Oracle access

### Optional

- [ ] Implement refresh tokens for longer sessions
- [ ] Add API versioning (`/api/v1/`)
- [ ] Set up CI/CD pipeline
- [ ] Add automated tests
- [ ] Configure CDN for static assets

---

## Health Check Configuration

The `/health` endpoint returns `{"status": "ok"}` without database dependency. Use this for load balancer health checks.

For database-inclusive health checks, use `/api/ping` (requires working Oracle connection).

---

## Environment-Specific Configurations

The application reads configuration from environment variables via `.env`. For different environments, create separate `.env` files:

```
backend/
├── .env              # Default (development)
├── .env.production   # Production overrides
└── .env.test         # Test environment
```

The `Settings` class reads from `.env` by default. To use a different file, set `ENV_FILE` environment variable or override in the deployment script.
