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
1. Get ALL Active Envs  → findAllActiveForRouting() → all environments with is_active=1 (across all servers)
2. Build Candidates     → for each env → groups → routes: build fullPattern = env.path + group.path + route.path
3. Sort by Specificity  → longest patterns first (most specific wins)
4. Match Request        → path-to-regexp match against fullPattern, extract :params from all 3 levels
5. Build Context        → { params, query, body, headers, method, _logs }
6. Evaluate Rules       → priority order ASC → conditionEvaluator.evaluate()
7. Resolve Template     → templateEngine.resolve(body, context)
8. Capture Request      → if captureRequests → save to request_logs + broadcast via Socket.IO
9. Send Response        → status + contentType + resolvedBody
10. Webhook Callback    → if rule has webhookUrl → fire async HTTP request (after response, with optional delay)
                          → log webhook request/response to request_logs + broadcast via Socket.IO
```

## Database Schema (SQLite)

```sql
servers (id, name, repo, token, branch, path, created_at, updated_at)

environments (id, name, base_path, description, is_active, slug, server_id, created_at, updated_at)
    └── groups (id, environment_id, name, path, sort_order, slug, created_at)
        └── routes (id, group_id, name, method, path_pattern, capture_requests, slug, created_at)
            └── rules (id, route_id, name, priority, conditions, status_code, content_type, body, delay,
                       webhook_url, webhook_method, webhook_headers, webhook_body, webhook_delay,
                       webhook_content_type, webhook_enabled, created_at)
            └── request_logs (id, route_id, environment_id, method, path, headers, query_params, body,
                              matched_rule_id, response_status, response_body,
                              webhook_url, webhook_method, webhook_request_headers, webhook_request_body,
                              webhook_response_status, webhook_response_headers, webhook_response_body,
                              webhook_error, created_at)
```

- `server_id` on environments links to a GitHub server (NULL = local)
- `path` on groups participates in URL concatenation (env.path + group.path + route.path)
- `slug` on environments, groups, and routes is used for GitHub sync file naming
- Webhook fields on rules configure async callbacks; webhook result fields on request_logs store the outcome

## Directory Structure

```
app.js                          # Main entry point (Express + Socket.IO setup)
src/
├── config/
│   ├── server.js               # Port, environment, body-parser config
│   └── database.js             # SQLite init, schema creation, migrations
├── controllers/
│   ├── environmentController.js # CRUD + copyToServer (with conflict detection)
│   ├── groupController.js      # CRUD + copyTo (with conflict detection)
│   ├── routeController.js      # CRUD + copyTo (with conflict detection), creates default rule
│   ├── ruleController.js
│   ├── requestLogController.js
│   ├── exportImportController.js
│   └── serverController.js     # GitHub server management, pull/push/sync
├── models/
│   ├── environment.js          # basePath sanitization (optional), validate, toJSON
│   ├── group.js                # name + optional path for URL concatenation
│   ├── route.js                # name + method + optional pathPattern
│   ├── rule.js                 # conditions, response, delay, webhook callback config
│   └── requestLog.js           # includes webhook result fields
├── repositories/               # Data access layer (SQL queries)
│   ├── environmentRepository.js # findAllActiveForRouting() returns all active across servers
│   ├── groupRepository.js
│   ├── routeRepository.js
│   ├── ruleRepository.js       # findByRouteId() returns sorted by priority ASC
│   └── requestLogRepository.js # updateWebhookResult() for async callback logging
├── services/
│   ├── mockRoutingEngine.js    # Core: 3-level URL matching (env+group+route), webhook callbacks
│   ├── conditionEvaluator.js   # AND/OR groups, 13 operators, case-insensitive headers
│   ├── templateEngine.js       # {{var}} resolution, fallback pipes, built-in variables
│   ├── socketService.js        # Socket.IO wrapper for real-time events
│   ├── githubSyncService.js    # GitHub API integration for pull/push with content hashing
│   ├── contentHashService.js   # SHA-256 content hashing for sync change detection
│   └── activeServerService.js  # Tracks which server context the UI is viewing
├── middleware/
│   ├── xmlParser.js            # Parses XML bodies, preserves rawXmlBody
│   ├── requestLogger.js
│   └── errorHandler.js
└── routes/
    ├── apiV2.js                # RESTful CRUD + copy + GitHub server endpoints
    └── api.js                  # Legacy webhook API
client/
├── src/
│   ├── main.js                 # Vue app init + Pinia + Router
│   ├── App.vue                 # Root component with <RouterView>
│   ├── views/
│   │   ├── Dashboard.vue       # Legacy webhook testing view
│   │   └── MockDashboard.vue   # MockHub main view (sidebar + route detail)
│   ├── components/mock/
│   │   ├── EnvironmentSidebar.vue  # Resizable tree nav + right-click context menus + copy flow
│   │   ├── RouteDetail.vue         # Tabs: Rules + Request Logs, full URL display
│   │   ├── RuleEditor.vue          # Rule card: highlighted body/webhook editors, tag insert, beautify
│   │   ├── ConditionBuilder.vue    # AND/OR conditions with field autocomplete
│   │   ├── RequestLogPanel.vue     # Log viewer with webhook callback results
│   │   ├── SyntaxHighlighter.vue   # JSON/XML colorization
│   │   ├── ServerSyncPanel.vue     # GitHub server selector + sync status
│   │   ├── CreateEnvironmentModal.vue
│   │   ├── CreateGroupModal.vue
│   │   ├── CreateRouteModal.vue
│   │   └── ImportModal.vue
│   ├── stores/
│   │   ├── mockStore.js        # Pinia store: environments, routes, rules, logs, servers, copy
│   │   ├── webhookStore.js     # Legacy webhook state
│   │   └── notificationStore.js
│   └── services/
│       ├── api.js              # Axios client with all API endpoints (preserves error.response)
│       └── socketService.js    # Socket.IO client wrapper
└── public-vue/                 # Vite build output (served by Express)
```
