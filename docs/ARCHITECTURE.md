# MockHub Architecture

## System Overview

MockHub is a configurable API mocker built on top of a webhook debugging server. It allows creating mock environments with dynamic routes, conditional rules, template-powered responses, and request logging.

**Stack:** Node.js + Express + SQLite + Socket.IO (backend) | Vue 3 + Pinia + Tailwind CSS + Vite (frontend)

## Request Flow

```
Client Request
    │
    ▼
Express Middleware Chain
    ├── body-parser (JSON, URL-encoded, text, raw)
    ├── xmlParser (parses XML bodies via fast-xml-parser)
    └── requestLogger (dev mode only)
    │
    ▼
Route Resolution
    ├── /api/*          → Legacy API v1 (webhookController)
    ├── /api/v2/*       → MockHub API v2 (CRUD for environments, groups, routes, rules)
    ├── /mock/* or /    → SPA fallback (serves Vue frontend)
    ├── Mock Engine     → mockRoutingEngine.handleRequest()
    └── Legacy Webhook  → webhookRoutes (fallback)
```

## Mock Routing Engine Flow

```
1. Match Environment    → findAllActive() → match by basePath prefix
2. Match Route          → findByEnvironmentId() → match by method + pathPattern (path-to-regexp)
3. Build Context        → { params, query, body, headers, method, _logs }
4. Evaluate Rules       → priority order ASC → conditionEvaluator.evaluate()
5. Resolve Template     → templateEngine.resolve(body, context)
6. Capture Request      → if captureRequests → save to request_logs + broadcast via Socket.IO
7. Send Response        → status + contentType + resolvedBody
```

## Database Schema (SQLite)

```sql
environments (id, name, base_path, description, is_active, created_at)
    └── groups (id, environment_id, name, sort_order, created_at)
        └── routes (id, group_id, method, path_pattern, capture_requests, created_at)
            └── rules (id, route_id, name, priority, conditions, status_code, content_type, body, delay, created_at)
            └── request_logs (id, route_id, environment_id, method, path, headers, query_params, body, matched_rule_id, response_status, response_body, created_at)
```

## Directory Structure

```
app.js                          # Main entry point (Express + Socket.IO setup)
src/
├── config/
│   ├── server.js               # Port, environment, body-parser config
│   └── database.js             # SQLite init, schema creation, migrations
├── controllers/
│   ├── environmentController.js
│   ├── groupController.js
│   ├── routeController.js      # Also creates default rule on route creation
│   ├── ruleController.js
│   ├── requestLogController.js
│   └── exportImportController.js
├── models/
│   ├── environment.js          # basePath sanitization, validate, toJSON
│   ├── group.js
│   ├── route.js
│   ├── rule.js                 # name, priority, conditions (JSON), statusCode, contentType, body, delay
│   └── requestLog.js
├── repositories/               # Data access layer (SQL queries)
│   ├── environmentRepository.js # findAllActive() returns sorted by basePath length DESC
│   ├── groupRepository.js
│   ├── routeRepository.js
│   ├── ruleRepository.js       # findByRouteId() returns sorted by priority ASC
│   └── requestLogRepository.js
├── services/
│   ├── mockRoutingEngine.js    # Core: matches env → route → rules → response
│   ├── conditionEvaluator.js   # AND/OR groups, 13 operators, case-insensitive headers
│   ├── templateEngine.js       # {{var}} resolution, fallback pipes, built-in variables
│   └── socketService.js        # Socket.IO wrapper for real-time events
├── middleware/
│   ├── xmlParser.js            # Parses XML bodies, preserves rawXmlBody
│   ├── requestLogger.js
│   └── errorHandler.js
└── routes/
    ├── apiV2.js                # RESTful CRUD for all MockHub entities
    └── api.js                  # Legacy webhook API
client/
├── src/
│   ├── main.js                 # Vue app init + Pinia + Router
│   ├── App.vue                 # Root component with <RouterView>
│   ├── views/
│   │   ├── Dashboard.vue       # Legacy webhook testing view
│   │   └── MockDashboard.vue   # MockHub main view (sidebar + route detail)
│   ├── components/mock/
│   │   ├── EnvironmentSidebar.vue  # Tree nav + context menu + documentation panel
│   │   ├── RouteDetail.vue         # Tabs: Rules + Request Logs, bulk import, drag reorder
│   │   ├── RuleEditor.vue          # Expandable rule card with syntax-highlighted body editor
│   │   ├── ConditionBuilder.vue    # AND/OR conditions with field autocomplete
│   │   ├── RequestLogPanel.vue     # Log viewer with syntax highlighting
│   │   ├── SyntaxHighlighter.vue   # JSON/XML colorization
│   │   ├── CreateEnvironmentModal.vue
│   │   ├── CreateGroupModal.vue
│   │   ├── CreateRouteModal.vue
│   │   └── ImportModal.vue
│   ├── stores/
│   │   ├── mockStore.js        # Pinia store: environments, routes, rules, logs
│   │   ├── webhookStore.js     # Legacy webhook state
│   │   └── notificationStore.js
│   └── services/
│       ├── api.js              # Axios client with all API endpoints
│       └── socketService.js    # Socket.IO client wrapper
└── public-vue/                 # Vite build output (served by Express)
```
