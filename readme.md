# MockHub

A configurable API mocker with dynamic routes, conditional rules, template-powered responses, and request logging. Simulate complete third-party APIs that lack test environments, redirect services to MockHub, and get realistic responses based on configurable rules.

**Stack:** Node.js + Express + SQLite + Socket.IO (backend) | Vue 3 + Pinia + Tailwind CSS + Vite (frontend)

## Features

- **Mock Environments** — Create isolated environments with unique base paths (`/stripe`, `/twilio`, etc.)
- **Dynamic Routes** — Define routes with Express-style path patterns (`:id`, `*wildcard`)
- **Conditional Rules** — Match requests by headers, body, query params using 13 operators with AND/OR logic
- **Template Responses** — Use `{{body.email}}`, `{{$uuid}}`, `{{$timestamp}}` and 30+ template variables
- **Request Logging** — Capture and inspect every incoming request with full headers, body, and response
- **Real-time Updates** — Socket.IO broadcasts new requests instantly to the dashboard
- **Export/Import** — Share mock configurations as JSON files between teams
- **Drag & Drop** — Reorder rule priority by dragging
- **XML Support** — Parse and respond with XML bodies
- **Log-based Templates** — Reference data from previous requests with `{{logs.*}}` and `{{lastlog.*}}`
- **Fallback Pipes** — Chain template variables with `|` for graceful fallbacks: `{{logs.body.id|body.id|$uuid}}`

## How It Works

```
Client Request → Match Environment (by basePath) → Match Route (method + pattern)
    → Evaluate Rules (priority order, conditions) → Resolve Template → Send Response
```

Rules are evaluated top-to-bottom. The first rule whose conditions match wins. A rule with no conditions acts as a default fallback.

## Installation

### With Docker

```bash
docker build -t mockhub .
docker run -p 1995:1995 -v mockhubdata:/app/data mockhub
```

### Manual

```bash
# Install dependencies
npm install
npm run client:install

# Build frontend
npm run client:build

# Start server
npm start
```

Open `http://localhost:1995` in your browser.

### Development Mode

```bash
# Terminal 1 — Backend (port 1995)
npm run dev

# Terminal 2 — Frontend with hot reload (port 1994, proxies to backend)
npm run client:dev
```

## Quick Start

1. **Create an environment** — Click "+" and set a name and base path (e.g., `/stripe`)
2. **Add a group** — Organize routes logically (e.g., "Payments", "Customers")
3. **Create a route** — Set method and path pattern (e.g., `POST /charges/:id`)
4. **Configure rules** — Add conditions and response bodies with template variables
5. **Send requests** — `curl http://localhost:1995/stripe/charges/ch_123` and see the mock response

## Condition Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `equals` | Exact match | `body.status` equals `"active"` |
| `not_equals` | Not equal | `headers.content-type` not_equals `"text/xml"` |
| `contains` | Substring match | `body.email` contains `"@gmail"` |
| `not_contains` | No substring | `body.name` not_contains `"test"` |
| `exists` | Field is present | `headers.authorization` exists |
| `not_exists` | Field is absent | `body.token` not_exists |
| `gt` / `gte` / `lt` / `lte` | Numeric comparison | `body.amount` gt `"100"` |
| `matches` | Regex match | `body.phone` matches `"^\+1\d{10}$"` |
| `exists_in_logs` | Value seen before | `body.email` exists_in_logs (enables `{{logs.*}}`) |
| `not_exists_in_logs` | Value never seen | `body.email` not_exists_in_logs |

Conditions support **AND/OR logic**. Groups separated by OR, each group evaluated with AND.

## Template Variables

### Request Data
`{{body.*}}`, `{{params.*}}`, `{{query.*}}`, `{{headers.*}}`, `{{method}}`

### Generated Values
`{{$uuid}}`, `{{$timestamp}}`, `{{$date}}`, `{{$time}}`, `{{$now}}`, `{{$randomInt}}`, `{{$randomFloat}}`, `{{$randomBool}}`, `{{$randomEmail}}`, `{{$randomName}}`, `{{$randomString:N}}`, `{{$seq}}`, `{{$enum:a,b,c}}`

### Log References
`{{logs.requestBody.*}}`, `{{logs.responseBody.*}}`, `{{logs.responseStatus}}`, `{{logs.timestamp}}`, `{{logs.headers.*}}` — data from the **first** matching log

`{{lastlog.*}}` — same fields but from the **most recent** matching log

### Advanced
- **Fallback pipes:** `{{logs.body.id|body.id|"unknown"}}` — tries each, uses first non-null
- **Repeat:** `{{$repeat:3:{"id":$i}}}` — generates repeated content with index

## API Reference (v2)

### Environments
- `GET /api/v2/environments` — List all
- `POST /api/v2/environments` — Create
- `GET /api/v2/environments/:id` — Get one
- `PUT /api/v2/environments/:id` — Update
- `DELETE /api/v2/environments/:id` — Delete
- `GET /api/v2/environments/:id/tree` — Full tree (groups + routes + rules)
- `GET /api/v2/environments/:id/export` — Export as JSON
- `POST /api/v2/environments/import` — Import from JSON

### Groups
- `POST /api/v2/environments/:envId/groups` — Create
- `PUT /api/v2/groups/:id` — Update
- `DELETE /api/v2/groups/:id` — Delete

### Routes
- `POST /api/v2/groups/:groupId/routes` — Create
- `GET /api/v2/routes/:id` — Get with rules
- `PUT /api/v2/routes/:id` — Update
- `DELETE /api/v2/routes/:id` — Delete

### Rules
- `POST /api/v2/routes/:routeId/rules` — Create
- `PUT /api/v2/rules/:id` — Update
- `DELETE /api/v2/rules/:id` — Delete

### Request Logs
- `GET /api/v2/routes/:routeId/logs` — Get logs for route
- `DELETE /api/v2/routes/:routeId/logs` — Clear logs

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system architecture, database schema, and directory structure.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1995` | Server port |
| `NODE_ENV` | `development` | Environment mode |

## License

MIT
