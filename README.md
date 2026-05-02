# Genogram Editor (React + React Flow + Mantine + Go)

This workspace contains:

- `frontend`: Vite + React + Mantine + React Flow genogram editor UI.
- `backend`: Go API with PostgreSQL persistence for diagrams.

## Features implemented

- Mantine header with load/save controls.
- Left palette with McGoldrick & Gerson basic person symbols:
  - Male (square)
  - Female (circle)
  - Unknown sex (diamond)
- Central React Flow canvas for family tree layout and links.
- Right details panel for editing selected person or relationship.
- Relationship types: partner, divorce, parent-child, adoption.
- Backend CRUD for diagrams and person details:
  - `POST /api/diagrams`
  - `GET /api/diagrams/{diagramId}`
  - `PUT /api/diagrams/{diagramId}`
  - `GET /api/diagrams/{diagramId}/persons/{personId}`
  - `PUT /api/diagrams/{diagramId}/persons/{personId}`

## Quick start

### 1) Start PostgreSQL

```powershell
docker compose up -d
```

### 2) Run backend

```powershell
Set-Location C:\Users\jacob.hoeflaken\GolandProjects\genogram\backend
Copy-Item .env.example .env
$env:DB_DSN = "postgres://genogram:genogram@localhost:5432/genogram?sslmode=disable"
go run ./cmd/server
```

Apply migration manually once:

```powershell
psql "postgres://genogram:genogram@localhost:5432/genogram?sslmode=disable" -f .\db\migrations\001_init.sql
```

### 3) Run frontend

```powershell
Set-Location C:\Users\jacob.hoeflaken\GolandProjects\genogram\frontend
npm install
npm run dev
```

## Tests

Backend:

```powershell
Set-Location C:\Users\jacob.hoeflaken\GolandProjects\genogram\backend
go test ./...
```

Frontend:

```powershell
Set-Location C:\Users\jacob.hoeflaken\GolandProjects\genogram\frontend
npm test
```

