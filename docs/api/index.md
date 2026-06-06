# API Endpoint Documentation

> Generated: 2026-06-07 | Confidence: HIGH

All API endpoints are documented in detail in [../backend/api_endpoints.md](../backend/api_endpoints.md).

## Quick Reference

### Public Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/api/ping` | DB connectivity |
| POST | `/api/auth/login` | Login → JWT |
| POST | `/api/auth/register` | Register |

### Protected Endpoints
| Method | Path | Roles |
|--------|------|-------|
| GET | `/api/user/roles` | (any) |
| GET | `/api/dashboards/mine` | viewer+ |
| POST | `/api/dashboards/` | editor, admin |
| GET | `/api/dashboards/{id}` | viewer+ |
| GET | `/api/dashboards/{id}/items` | viewer+ |
| GET | `/api/dashboards/{id}/tabs` | viewer+ |
| GET | `/api/dashboards/{id}/filter-groups` | viewer+ |
| POST | `/api/editor/sql/execute` | editor, admin |
| POST | `/api/editor/sql/save` | editor, admin |
| GET | `/api/editor/sql/saved` | editor, admin |
