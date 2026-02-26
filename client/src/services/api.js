import axios from 'axios'

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    console.log('Making API request:', config.method?.toUpperCase(), config.url)
    return config
  },
  (error) => {
    console.error('API Request Error:', error)
    return Promise.reject(error)
  }
)

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log('API response received:', response.status, response.config.url, response.data)
    return response
  },
  (error) => {
    const message = error.response?.data?.error || error.message || 'An error occurred'
    console.error('API Error:', message, error)
    return Promise.reject(new Error(message))
  }
)

// Webhook API endpoints
export const webhookApi = {
  // Endpoints
  getEndpoints: () => apiClient.get('/endpoints'),
  createEndpoint: (data) => apiClient.post('/endpoints', data),
  deleteEndpoint: (path) => apiClient.delete(`/endpoints/${encodeURIComponent(path)}`),
  
  // Requests
  getEndpointRequests: (path) => apiClient.get(`/endpoints/${encodeURIComponent(path)}/requests`),
  deleteRequest: (path, requestId) => apiClient.delete(`/endpoints/${encodeURIComponent(path)}/requests/${requestId}`),
  clearEndpointRequests: (path) => apiClient.delete(`/endpoints/${encodeURIComponent(path)}/requests`),
  
  // Response Configuration
  getResponseConfig: (path) => apiClient.get(`/endpoints/${encodeURIComponent(path)}/response`),
  updateResponseConfig: (path, config) => apiClient.put(`/endpoints/${encodeURIComponent(path)}/response`, config),
  
  // Health check
  ping: () => apiClient.get('/health').catch(() => ({ data: { status: 'error' } })),

  // MockHub API v2
  // Environments
  getEnvironments: (params) => apiClient.get('/v2/environments', { params }),
  createEnvironment: (data) => apiClient.post('/v2/environments', data),
  getEnvironment: (id) => apiClient.get(`/v2/environments/${id}`),
  updateEnvironment: (id, data) => apiClient.put(`/v2/environments/${id}`, data),
  deleteEnvironment: (id) => apiClient.delete(`/v2/environments/${id}`),
  getEnvironmentTree: (id) => apiClient.get(`/v2/environments/${id}/tree`),
  copyEnvironmentToServer: (id, targetServerId) => apiClient.post(`/v2/environments/${id}/copy`, { target_server_id: targetServerId }),

  // Groups
  getGroups: (envId) => apiClient.get(`/v2/environments/${envId}/groups`),
  createGroup: (envId, data) => apiClient.post(`/v2/environments/${envId}/groups`, data),
  updateGroup: (id, data) => apiClient.put(`/v2/groups/${id}`, data),
  deleteGroup: (id) => apiClient.delete(`/v2/groups/${id}`),

  // Routes
  getRoutes: (groupId) => apiClient.get(`/v2/groups/${groupId}/routes`),
  createRoute: (groupId, data) => apiClient.post(`/v2/groups/${groupId}/routes`, data),
  getRoute: (id) => apiClient.get(`/v2/routes/${id}`),
  updateRoute: (id, data) => apiClient.put(`/v2/routes/${id}`, data),
  deleteRoute: (id) => apiClient.delete(`/v2/routes/${id}`),

  // Rules
  getRules: (routeId) => apiClient.get(`/v2/routes/${routeId}/rules`),
  createRule: (routeId, data) => apiClient.post(`/v2/routes/${routeId}/rules`, data),
  updateRule: (id, data) => apiClient.put(`/v2/rules/${id}`, data),
  deleteRule: (id) => apiClient.delete(`/v2/rules/${id}`),

  // Request Logs
  getRouteLogs: (routeId) => apiClient.get(`/v2/routes/${routeId}/logs`),
  clearRouteLogs: (routeId) => apiClient.delete(`/v2/routes/${routeId}/logs`),
  getEnvironmentLogs: (envId) => apiClient.get(`/v2/environments/${envId}/logs`),
  clearEnvironmentLogs: (envId) => apiClient.delete(`/v2/environments/${envId}/logs`),
  deleteLog: (id) => apiClient.delete(`/v2/logs/${id}`),

  // Export/Import
  exportEnvironment: (id) => apiClient.get(`/v2/environments/${id}/export`),
  importEnvironment: (data) => apiClient.post('/v2/environments/import', data),

  // Servers
  getServers: () => apiClient.get('/v2/servers'),
  createServer: (data) => apiClient.post('/v2/servers', data),
  updateServer: (id, data) => apiClient.put(`/v2/servers/${id}`, data),
  deleteServer: (id) => apiClient.delete(`/v2/servers/${id}`),
  testServerConnection: (id) => apiClient.post(`/v2/servers/${id}/test`),
  getServerEnvironments: (id) => apiClient.get(`/v2/servers/${id}/environments`),
  pullFromServer: (id, data) => apiClient.post(`/v2/servers/${id}/pull`, data, { timeout: 60000 }),
  pushToServer: (id, data) => apiClient.post(`/v2/servers/${id}/push`, data, { timeout: 60000 }),
  pushGroupToServer: (id, data) => apiClient.post(`/v2/servers/${id}/push/group`, data, { timeout: 60000 }),
  pushRouteToServer: (id, data) => apiClient.post(`/v2/servers/${id}/push/route`, data, { timeout: 60000 }),
  getServerSyncStatus: (id) => apiClient.get(`/v2/servers/${id}/sync-status`),
  copyBetweenServers: (sourceId, targetId, data) => apiClient.post(`/v2/servers/${sourceId}/copy/${targetId}`, data, { timeout: 120000 }),

  // Active server
  getActiveServer: () => apiClient.get('/v2/active-server'),
  setActiveServer: (serverId) => apiClient.put('/v2/active-server', { serverId }),
}

export default apiClient