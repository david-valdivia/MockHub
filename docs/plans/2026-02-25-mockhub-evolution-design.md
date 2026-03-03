# MockHub — Evolution Design Document

## Vision

Evolve the Webhook Testing Server into a configurable API mocker/sandbox replacement. The core use case: simulate complete third-party APIs that lack test environments, redirect services to MockHub, and get realistic responses based on configurable rules. Export/import configurations to share with colleagues.

## Data Model

### Hierarchy

```
Environment ("Stripe Mock", base_path: /stripe)
  └── Group ("Charges", order: 0)
        └── Route (POST /charges/:id)
              └── Rules (ordered by priority)
                    ├── Rule 0: if no Authorization → 401
                    ├── Rule 1: if params.id == "error" → 500
                    └── Rule 2: default → 200 + template body
```

### Entities

**Environment**
- id (INTEGER PRIMARY KEY)
- name (TEXT NOT NULL)
- base_path (TEXT UNIQUE NOT NULL) — e.g. `/stripe`
- description (TEXT)
- created_at (TIMESTAMP)

**Group**
- id (INTEGER PRIMARY KEY)
- environment_id (INTEGER FK → environments ON DELETE CASCADE)
- name (TEXT NOT NULL)
- order (INTEGER DEFAULT 0)

**Route**
- id (INTEGER PRIMARY KEY)
- group_id (INTEGER FK → groups ON DELETE CASCADE)
- method (TEXT NOT NULL) — GET, POST, PUT, DELETE, PATCH, ALL
- path (TEXT NOT NULL) — supports `:param` syntax, e.g. `/charges/:id`
- capture_requests (BOOLEAN DEFAULT 1)
- order (INTEGER DEFAULT 0)

**Rule**
- id (INTEGER PRIMARY KEY)
- route_id (INTEGER FK → routes ON DELETE CASCADE)
- priority (INTEGER NOT NULL DEFAULT 0) — lower = evaluated first
- conditions (TEXT — JSON array) — empty array = default/fallback rule
- status_code (INTEGER DEFAULT 200)
- content_type (TEXT DEFAULT 'application/json')
- body (TEXT) — supports `{{template}}` syntax
- delay (INTEGER DEFAULT 0) — milliseconds, 0-10000

**RequestLog**
- id (INTEGER PRIMARY KEY)
- route_id (INTEGER FK → routes ON DELETE CASCADE)
- method (TEXT NOT NULL)
- headers (TEXT — JSON)
- query_params (TEXT — JSON)
- body (TEXT)
- matched_rule_id (INTEGER — nullable FK → rules)
- response_status (INTEGER)
- response_body (TEXT)
- timestamp (TIMESTAMP)

## Routing Engine

### Request Flow

```
Incoming: POST /stripe/charges/ch_123

1. Match Environment by base_path
   → "Stripe Mock" (base_path: /stripe)
   → remaining path: /charges/ch_123

2. Match Route by method + path pattern
   → POST /charges/:id → params = { id: "ch_123" }

3. Evaluate Rules by priority (ascending)
   → Rule 0: headers.authorization not_exists? → NO, skip
   → Rule 1: params.id equals "error"? → NO, skip
   → Rule 2: no conditions (default) → MATCH

4. Resolve response template
   → Replace {{params.id}} with "ch_123"
   → Apply delay if configured

5. Capture request (if enabled on route)
   → Save to request_logs with matched_rule_id
   → Notify via WebSocket

6. Send response
```

### Environment Matching

- All environments evaluated by `base_path`
- Most specific match wins (`/stripe/v2` before `/stripe`)
- If no environment matches, return configurable 404

### Route Matching

- Routes within matched environment evaluated by method + path pattern
- Path params extracted Express-style (`:id`, `:chargeId`)
- `ALL` method matches any HTTP method
- If no route matches, return configurable 404 per environment

## Template System

### Variables

Available in rule response body:

| Variable | Source | Example |
|----------|--------|---------|
| `{{params.id}}` | Path parameters | `ch_123` |
| `{{query.page}}` | Query string | `2` |
| `{{body.amount}}` | Request body (dot notation) | `5000` |
| `{{body.customer.email}}` | Nested body fields | `a@b.com` |
| `{{headers.authorization}}` | Request headers (lowercase) | `Bearer tok_...` |
| `{{method}}` | HTTP method | `POST` |
| `{{$timestamp}}` | Current ISO timestamp | `2026-02-25T...` |
| `{{$uuid}}` | Generated UUID v4 | `550e8400-...` |

### Resolution

- Templates resolved at response time
- Missing variables resolve to empty string
- Body dot notation supports nested objects

## Condition System

### Structure

Each rule has a `conditions` array with AND/OR logic (conditions joined by `"logic": "or"` start a new OR group):

```json
[
  { "field": "headers.authorization", "operator": "not_exists" },
  { "field": "body.amount", "operator": "gt", "value": 10000 },
  { "field": "body.email", "operator": "exists_in_logs", "source": ["body.email", "responseBody.user.email"], "logic": "or" }
]
```

### Operators

| Operator | Description | Value required |
|----------|-------------|----------------|
| `equals` | Exact match | Yes |
| `not_equals` | Not exact match | Yes |
| `contains` | Substring match | Yes |
| `not_contains` | No substring match | Yes |
| `exists` | Field is present | No |
| `not_exists` | Field is absent | No |
| `gt` | Greater than (numeric) | Yes |
| `gte` | Greater or equal (numeric) | Yes |
| `lt` | Less than (numeric) | Yes |
| `lte` | Less or equal (numeric) | Yes |
| `matches` | Regex match | Yes (pattern) |
| `exists_in_logs` | Value found in previous request logs | No |
| `not_exists_in_logs` | Value not found in previous logs | No |

#### `source` field (for log operators)

`exists_in_logs` and `not_exists_in_logs` support an optional `source` array to search in alternative paths within logs:

```json
{
  "field": "body.email",
  "operator": "exists_in_logs",
  "source": ["body.email", "body.data.userEmail", "responseBody.user.email"]
}
```

- Takes the value from `field` in the current request
- Searches each path in `source` across previous request logs
- If `source` is empty or omitted, falls back to using `field` (backward compatible)
- Available log paths: `body.*`, `requestBody.*`, `responseBody.*`, `headers.*`, `queryParams.*`, `method`, `path`, `responseStatus`

### Field Resolution

Same as template variables: `params.*`, `query.*`, `body.*`, `headers.*`, `method`.

### Evaluation

- Rules evaluated in priority order (ascending)
- First rule where ALL conditions match wins
- Empty conditions array = always matches (default/fallback rule)
- Every route should have at least one default rule

## Export/Import

### Format

Single JSON file per environment:

```json
{
  "mockhub_version": "1.0",
  "exported_at": "2026-02-25T10:30:00Z",
  "environment": {
    "name": "Stripe Mock",
    "base_path": "/stripe",
    "description": "Stripe API v1 simulation",
    "groups": [
      {
        "name": "Charges",
        "order": 0,
        "routes": [
          {
            "method": "POST",
            "path": "/charges",
            "capture_requests": true,
            "order": 0,
            "rules": [
              {
                "priority": 0,
                "conditions": [
                  { "field": "headers.authorization", "operator": "not_exists" }
                ],
                "response": {
                  "status_code": 401,
                  "content_type": "application/json",
                  "body": "{\"error\": \"unauthorized\"}",
                  "delay": 0
                }
              },
              {
                "priority": 1,
                "conditions": [],
                "response": {
                  "status_code": 200,
                  "content_type": "application/json",
                  "body": "{\"id\": \"ch_{{$uuid}}\", \"amount\": {{body.amount}}}",
                  "delay": 100
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Behavior

- **Export:** Button per environment in UI → downloads `.json`
- **Import:** Button in UI → select file → preview → confirm
- **Conflict:** If `base_path` exists, offer rename or overwrite
- **No request logs:** Export only includes configuration, never captured requests (keeps files small, avoids leaking sensitive data)

## Frontend

### Layout

```
┌──────────────────────────────────────────────────┐
│  MockHub                           [Import] [+Env]│
├───────────────┬──────────────────────────────────┤
│ Environments  │  Route Detail                     │
│               │                                   │
│ ▼ Stripe Mock │  POST /charges/:id                │
│   ▼ Charges   │  ┌──────────┬───────────┐        │
│     POST /ch  │  │  Rules   │ Requests  │        │
│     GET /ch/: │  ├──────────┴───────────┤        │
│   ▼ Refunds   │  │ Rule 1 (pri: 0)      │        │
│     POST /ref │  │  if: no Auth → 401    │        │
│               │  │                       │        │
│ ▼ PayPal Mock │  │ Rule 2 (pri: 1)      │        │
│   ...         │  │  default → 200        │        │
│               │  │                       │        │
│               │  │ [+ Add Rule]          │        │
└───────────────┴──────────────────────────────────┘
```

### Views

- **Sidebar:** Collapsible tree — Environment → Group → Route. Context actions per level (export, delete, add group, add route).
- **Environment View:** General info, base_path, description, export button, stats.
- **Route View:** Two tabs — Rules (sortable list) and Requests (real-time log).
- **Rule Editor:** Expandable panel or modal — priority, visual condition builder (field + operator + value), response config (status, content-type, body editor with template highlighting), delay.

### Styling

Full Tailwind CSS. Remove all legacy styles.

## Migration Strategy

### Legacy Data Conversion

```
Current endpoint "payments"  →  Environment "Legacy"
                                  └── Group "Default"
                                        └── Route: ALL /payments
                                              └── Rule (priority 0, default)
                                                   → current response config
```

### Plan

1. Create new tables alongside existing ones
2. Auto-migration on startup: detect legacy endpoints without environment, migrate to "Legacy" environment
3. Keep old tables until migration confirmed stable, then drop

### API Versioning

- New API: `/api/v2/environments/...`
- Current API `/api/endpoints/...` continues working during transition, backed by new model
- Catch-all `/:path` replaced by `/:base_path/*` with new routing engine

### Preserved Features

- WebSocket/Socket.IO — same mechanics, new events (`routeMatched`, `ruleEvaluated`)
- Browser notifications — unchanged
- Docker setup — unchanged
- Request capture — same philosophy, new data model

## API Endpoints (v2)

### Environments
- `GET /api/v2/environments` — list all
- `POST /api/v2/environments` — create
- `GET /api/v2/environments/:id` — get with groups/routes/rules
- `PUT /api/v2/environments/:id` — update
- `DELETE /api/v2/environments/:id` — delete (cascade)
- `POST /api/v2/environments/:id/export` — export JSON
- `POST /api/v2/environments/import` — import JSON

### Groups
- `GET /api/v2/environments/:envId/groups` — list
- `POST /api/v2/environments/:envId/groups` — create
- `PUT /api/v2/groups/:id` — update
- `DELETE /api/v2/groups/:id` — delete (cascade)

### Routes
- `GET /api/v2/groups/:groupId/routes` — list
- `POST /api/v2/groups/:groupId/routes` — create
- `PUT /api/v2/routes/:id` — update
- `DELETE /api/v2/routes/:id` — delete (cascade)

### Rules
- `GET /api/v2/routes/:routeId/rules` — list (ordered by priority)
- `POST /api/v2/routes/:routeId/rules` — create
- `PUT /api/v2/rules/:id` — update
- `DELETE /api/v2/rules/:id` — delete
- `PUT /api/v2/routes/:routeId/rules/reorder` — reorder priorities

### Request Logs
- `GET /api/v2/routes/:routeId/requests` — list captured requests
- `DELETE /api/v2/routes/:routeId/requests` — clear all
- `DELETE /api/v2/requests/:id` — delete one
