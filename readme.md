# MockHub

A configurable API mocker with dynamic routes, conditional rules, template-powered responses, and request logging. Simulate complete third-party APIs that lack test environments, redirect services to MockHub, and get realistic responses based on configurable rules.

**Stack:** Node.js + Express + SQLite + Socket.IO (backend) | Vue 3 + Pinia + Tailwind CSS + Vite (frontend)

## Features

### Core
- **Mock Environments** — Create isolated environments with optional URL paths (`/stripe`, `/twilio`, etc.)
- **Dynamic Routes** — Define routes with Express-style path patterns (`:id`, `*wildcard`)
- **3-Level URL Concatenation** — Environment path + Group path + Route path, each level optional with `:param` support
- **Conditional Rules** — Match requests by headers, body, query params using 13 operators with AND/OR logic
- **Template Responses** — Use `{{body.email}}`, `{{$uuid}}`, `{{$timestamp}}` and 30+ template variables
- **Async Webhook Callbacks** — Fire HTTP callbacks after response is sent, with configurable delay, method, headers, body templates, and full request/response logging
- **Request Logging** — Capture and inspect every incoming request with full headers, body, response, and webhook callback results
- **Real-time Updates** — Socket.IO broadcasts new requests instantly to the dashboard

### Organization & Editing
- **Right-click Context Menus** — Edit name, path, copy, duplicate, and delete on all 3 levels (environment, group, route)
- **Drag & Drop** — Reorder rule priority by dragging
- **Resizable Sidebar** — Drag to resize between 200px and 400px, persisted across sessions
- **Export/Import** — Share mock configurations as JSON files between teams

### GitHub Sync
- **GitHub Servers** — Connect GitHub repos as servers to store/sync mock configurations
- **Pull/Push** — Sync environments to/from GitHub repos with content hash change detection
- **Granular Push** — Push individual groups or routes instead of full environments
- **Server Tenants** — Each GitHub server has independent environments, isolated from local ones

### Copy & Reuse
- **Cross-server Copy** — Copy environments, groups, or routes between Local and GitHub servers
- **Conflict Detection** — When copying to a location where the item already exists, choose: keep both or replace
- **Copy at Any Level** — Copy an entire environment, a single group (with routes/rules), or a single route (with rules)

### Templates & Editing
- **Syntax-highlighted Body Editor** — JSON/XML/template highlighting for response and webhook bodies
- **Insert Tag Panel** — Click to insert template variables from categorized panels (both response and webhook body)
- **Beautify** — Auto-format JSON/XML in response and webhook body editors
- **XML Support** — Parse and respond with XML bodies
- **Log-based Templates** — Reference data from previous requests with `{{logs.*}}` and `{{lastlog.*}}`
- **Fallback Pipes** — Chain template variables with `|` for graceful fallbacks: `{{logs.body.id|body.id|$uuid}}`

## How It Works

```
Client Request → Match Route (env.path + group.path + route.path concatenated)
    → Evaluate Rules (priority order, conditions) → Resolve Template → Send Response
    → Fire Webhook Callback (async, after response)
```

The routing engine concatenates paths from all 3 levels (environment, group, route) into a full URL pattern, matches using `path-to-regexp`, and extracts `:param` variables from any level. Routes from all active environments are candidates, sorted by specificity (longest pattern first). Rules are evaluated top-to-bottom; the first rule whose conditions match wins. A rule with no conditions acts as a default fallback.

## Installation

### With Docker

```bash
# Build
docker build -t mockhub .

# Run (data persisted in volume)
docker run -d -p 1995:1995 -v mockhubdata:/app/data --name mockhub mockhub

# Stop / Start
docker stop mockhub
docker start mockhub

# View logs
docker logs -f mockhub
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

1. **Create an environment** — Click "+" and set a name and optional path (e.g., `/stripe`)
2. **Add a group** — Organize routes logically (e.g., "Payments" with path `/payments`)
3. **Create a route** — Set name, method, and path (e.g., `POST /:id`)
4. **Configure rules** — Add conditions and response bodies with template variables
5. **Send requests** — `curl -X POST http://localhost:1995/stripe/payments/ch_123` and see the mock response
6. **Add a callback** — Configure an async webhook in the rule to fire after the response
7. **Right-click** — Edit names, paths, copy, or duplicate at any level

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
- `GET /api/v2/environments` — List all (filter: `?server_id=local` or `?server_id=<id>`)
- `POST /api/v2/environments` — Create
- `GET /api/v2/environments/:id` — Get one
- `PUT /api/v2/environments/:id` — Update
- `DELETE /api/v2/environments/:id` — Delete
- `GET /api/v2/environments/:id/tree` — Full tree (groups + routes + rules)
- `POST /api/v2/environments/:id/copy` — Copy to another server (body: `target_server_id`, `conflict_strategy`)
- `GET /api/v2/environments/:id/export` — Export as JSON
- `POST /api/v2/environments/import` — Import from JSON

### Groups
- `POST /api/v2/environments/:envId/groups` — Create
- `PUT /api/v2/groups/:id` — Update
- `DELETE /api/v2/groups/:id` — Delete
- `POST /api/v2/groups/:id/copy` — Copy to another environment (body: `target_environment_id`, `conflict_strategy`)

### Routes
- `POST /api/v2/groups/:groupId/routes` — Create
- `GET /api/v2/routes/:id` — Get with rules
- `PUT /api/v2/routes/:id` — Update
- `DELETE /api/v2/routes/:id` — Delete
- `POST /api/v2/routes/:id/copy` — Copy to another group (body: `target_group_id`, `conflict_strategy`)

### Rules
- `POST /api/v2/routes/:routeId/rules` — Create
- `PUT /api/v2/rules/:id` — Update
- `DELETE /api/v2/rules/:id` — Delete

### Request Logs
- `GET /api/v2/routes/:routeId/logs` — Get logs for route
- `DELETE /api/v2/routes/:routeId/logs` — Clear logs
- `GET /api/v2/environments/:envId/logs` — Get logs for environment
- `DELETE /api/v2/environments/:envId/logs` — Clear logs for environment

### GitHub Servers
- `GET /api/v2/servers` — List all servers
- `POST /api/v2/servers` — Create server (body: `name`, `repo`, `token`, `branch`, `path`)
- `PUT /api/v2/servers/:id` — Update server
- `DELETE /api/v2/servers/:id` — Delete server
- `POST /api/v2/servers/:id/test` — Test GitHub connection
- `GET /api/v2/servers/:id/environments` — List remote environments on GitHub
- `POST /api/v2/servers/:id/pull` — Pull environment from GitHub
- `POST /api/v2/servers/:id/push` — Push environment to GitHub
- `POST /api/v2/servers/:id/push/group` — Push individual group to GitHub
- `POST /api/v2/servers/:id/push/route` — Push individual route to GitHub
- `GET /api/v2/servers/:id/sync-status` — Get content hash sync status

### Active Server
- `GET /api/v2/active-server` — Get active server for routing
- `PUT /api/v2/active-server` — Set active server (body: `serverId`)

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed system architecture, database schema, and directory structure.

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `1995` | Server port |
| `NODE_ENV` | `development` | Environment mode |

## License

MIT
