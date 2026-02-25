# MockHub Frontend

Vue 3 frontend for MockHub — configurable API mocker.

## Stack

- **Vue 3** with Composition API (`<script setup>`)
- **Pinia** for state management
- **Vue Router** for client-side routing
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **Socket.IO Client** for real-time updates
- **Axios** for HTTP requests
- **SweetAlert2** for dialogs
- **Heroicons** for icons

## Development

```bash
npm install
npm run dev      # Dev server on http://localhost:1994 (proxies to backend :1995)
npm run build    # Production build to ../public-vue/
```

## Structure

```
src/
├── views/
│   ├── Dashboard.vue           # Legacy webhook testing view
│   └── MockDashboard.vue       # MockHub main view
├── components/mock/
│   ├── EnvironmentSidebar.vue  # Tree nav + context menu + docs panel
│   ├── RouteDetail.vue         # Tabs: Rules + Request Logs
│   ├── RuleEditor.vue          # Rule card with syntax-highlighted body editor
│   ├── ConditionBuilder.vue    # AND/OR conditions with field autocomplete
│   ├── RequestLogPanel.vue     # Log viewer with syntax highlighting
│   ├── SyntaxHighlighter.vue   # JSON/XML colorization with copy button
│   ├── CreateEnvironmentModal.vue
│   ├── CreateGroupModal.vue
│   ├── CreateRouteModal.vue
│   └── ImportModal.vue
├── stores/
│   ├── mockStore.js            # Environments, routes, rules, logs
│   ├── webhookStore.js         # Legacy webhook state
│   └── notificationStore.js
└── services/
    ├── api.js                  # Axios client with all API endpoints
    └── socketService.js        # Socket.IO client wrapper
```
