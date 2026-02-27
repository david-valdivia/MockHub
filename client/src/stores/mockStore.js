import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { webhookApi } from '@/services/api'
import { socketService } from '@/services/socketService'
import { useNotificationStore } from './notificationStore'

export const useMockStore = defineStore('mock', () => {
  const environments = ref([])
  const activeEnvironment = ref(null) // full tree
  const activeRoute = ref(null) // { ...route, rules: [] }
  const routeLogs = ref([])
  const loading = ref(false)
  const servers = ref([])
  const activeServer = ref(null)
  const syncStatus = ref(null) // { environments: {id: {status}}, groups: {}, routes: {} }
  const activeSyncServerId = ref(null)

  const activeEnvironmentId = computed(() => activeEnvironment.value?.id || null)
  const activeRouteId = computed(() => activeRoute.value?.id || null)

  // Refresh sync status if a server is selected (non-blocking, fire-and-forget)
  function refreshSyncStatus() {
    if (activeSyncServerId.value) {
      loadSyncStatus(activeSyncServerId.value)
    }
  }

  async function loadEnvironments() {
    try {
      loading.value = true
      const params = {}
      if (activeSyncServerId.value) {
        params.server_id = activeSyncServerId.value
      } else {
        params.server_id = 'local'
      }
      const response = await webhookApi.getEnvironments(params)
      environments.value = response.data
    } catch (error) {
      console.error('Failed to load environments:', error)
    } finally {
      loading.value = false
    }
  }

  async function selectEnvironment(id) {
    try {
      loading.value = true
      const response = await webhookApi.getEnvironmentTree(id)
      activeEnvironment.value = response.data
      activeRoute.value = null
      routeLogs.value = []
    } catch (error) {
      console.error('Failed to load environment tree:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function createEnvironment(data) {
    // Tag new environments with the active server
    if (activeSyncServerId.value) {
      data.server_id = activeSyncServerId.value
    }
    const response = await webhookApi.createEnvironment(data)
    await loadEnvironments()
    refreshSyncStatus()
    return response.data
  }

  async function updateEnvironment(id, data) {
    const response = await webhookApi.updateEnvironment(id, data)
    if (activeEnvironmentId.value === id) {
      await selectEnvironment(id)
    }
    await loadEnvironments()
    refreshSyncStatus()
    return response.data
  }

  async function deleteEnvironment(id) {
    await webhookApi.deleteEnvironment(id)
    if (activeEnvironmentId.value === id) {
      activeEnvironment.value = null
      activeRoute.value = null
      routeLogs.value = []
    }
    await loadEnvironments()
    refreshSyncStatus()
  }

  async function createGroup(envId, data) {
    const response = await webhookApi.createGroup(envId, data)
    await selectEnvironment(envId)
    refreshSyncStatus()
    return response.data
  }

  async function updateGroup(id, data) {
    const response = await webhookApi.updateGroup(id, data)
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
    refreshSyncStatus()
    return response.data
  }

  async function deleteGroup(id) {
    await webhookApi.deleteGroup(id)
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
    refreshSyncStatus()
  }

  async function createRoute(groupId, data) {
    const response = await webhookApi.createRoute(groupId, data)
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
    refreshSyncStatus()
    return response.data
  }

  async function selectRoute(routeId) {
    try {
      const response = await webhookApi.getRoute(routeId)
      activeRoute.value = response.data
      await loadRouteLogs(routeId)
    } catch (error) {
      console.error('Failed to load route:', error)
      throw error
    }
  }

  async function updateRoute(id, data) {
    const response = await webhookApi.updateRoute(id, data)
    if (activeRouteId.value === id) {
      activeRoute.value = { ...activeRoute.value, ...response.data }
    }
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
    refreshSyncStatus()
    return response.data
  }

  async function deleteRoute(id) {
    await webhookApi.deleteRoute(id)
    if (activeRouteId.value === id) {
      activeRoute.value = null
      routeLogs.value = []
    }
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
    refreshSyncStatus()
  }

  async function createRule(routeId, data) {
    const response = await webhookApi.createRule(routeId, data)
    if (activeRouteId.value === routeId) {
      await selectRoute(routeId)
    }
    refreshSyncStatus()
    return response.data
  }

  async function updateRule(id, data) {
    const response = await webhookApi.updateRule(id, data)
    if (activeRoute.value) {
      await selectRoute(activeRoute.value.id)
    }
    refreshSyncStatus()
    return response.data
  }

  async function deleteRule(id) {
    await webhookApi.deleteRule(id)
    if (activeRoute.value) {
      await selectRoute(activeRoute.value.id)
    }
    refreshSyncStatus()
  }

  async function loadRouteLogs(routeId) {
    try {
      const response = await webhookApi.getRouteLogs(routeId)
      routeLogs.value = response.data
    } catch (error) {
      console.error('Failed to load route logs:', error)
    }
  }

  async function clearRouteLogs(routeId) {
    await webhookApi.clearRouteLogs(routeId)
    routeLogs.value = []
  }

  async function copyEnvironmentToServer(envId, targetServerId, conflictStrategy) {
    const response = await webhookApi.copyEnvironmentToServer(envId, targetServerId, conflictStrategy)
    await loadEnvironments()
    return response.data
  }

  async function copyGroupTo(groupId, targetEnvId, conflictStrategy) {
    const response = await webhookApi.copyGroup(groupId, { target_environment_id: targetEnvId, conflict_strategy: conflictStrategy })
    await loadEnvironments()
    return response.data
  }

  async function copyRouteTo(routeId, targetGroupId, conflictStrategy) {
    const response = await webhookApi.copyRoute(routeId, { target_group_id: targetGroupId, conflict_strategy: conflictStrategy })
    await loadEnvironments()
    return response.data
  }

  async function exportEnvironment(id) {
    const response = await webhookApi.exportEnvironment(id)
    return response.data
  }

  async function importEnvironment(data) {
    const response = await webhookApi.importEnvironment(data)
    await loadEnvironments()
    refreshSyncStatus()
    return response.data
  }

  // Server methods
  async function loadServers() {
    try {
      const response = await webhookApi.getServers()
      servers.value = response.data
    } catch (error) {
      console.error('Failed to load servers:', error)
    }
  }

  async function createServer(data) {
    const response = await webhookApi.createServer(data)
    await loadServers()
    return response.data
  }

  async function updateServer(id, data) {
    const response = await webhookApi.updateServer(id, data)
    await loadServers()
    return response.data
  }

  async function deleteServer(id) {
    await webhookApi.deleteServer(id)
    if (activeServer.value?.id === id) {
      activeServer.value = null
    }
    if (activeSyncServerId.value === id) {
      activeSyncServerId.value = null
      syncStatus.value = null
    }
    await loadServers()
  }

  async function testServerConnection(id) {
    const response = await webhookApi.testServerConnection(id)
    return response.data
  }

  async function getServerEnvironments(id) {
    const response = await webhookApi.getServerEnvironments(id)
    return response.data
  }

  async function pullFromServer(serverId, envSlug) {
    const response = await webhookApi.pullFromServer(serverId, { envSlug })
    await loadEnvironments()
    await loadServers()
    refreshSyncStatus()
    return response.data
  }

  async function pushToServer(serverId, envId) {
    const response = await webhookApi.pushToServer(serverId, { envId })
    await loadServers()
    refreshSyncStatus()
    return response.data
  }

  async function pushGroupToServer(serverId, groupId) {
    const response = await webhookApi.pushGroupToServer(serverId, { groupId })
    await loadServers()
    refreshSyncStatus()
    return response.data
  }

  async function pushRouteToServer(serverId, routeId) {
    const response = await webhookApi.pushRouteToServer(serverId, { routeId })
    await loadServers()
    refreshSyncStatus()
    return response.data
  }

  function setActiveServer(server) {
    activeServer.value = server
  }

  async function loadSyncStatus(serverId) {
    try {
      activeSyncServerId.value = serverId
      const response = await webhookApi.getServerSyncStatus(serverId)
      syncStatus.value = response.data
    } catch (error) {
      console.error('Failed to load sync status:', error)
      syncStatus.value = null
    }
  }

  async function selectRemoteServer(serverId) {
    activeSyncServerId.value = serverId
    localStorage.setItem('mockhub_activeServerId', serverId)
    activeEnvironment.value = null
    activeRoute.value = null
    routeLogs.value = []
    await webhookApi.setActiveServer(serverId)
    await loadEnvironments()
    loadSyncStatus(serverId)
  }

  async function selectLocalServer() {
    activeSyncServerId.value = null
    localStorage.removeItem('mockhub_activeServerId')
    syncStatus.value = null
    activeEnvironment.value = null
    activeRoute.value = null
    routeLogs.value = []
    await webhookApi.setActiveServer(null)
    await loadEnvironments()
  }

  function clearSyncStatus() {
    activeSyncServerId.value = null
    syncStatus.value = null
    remoteEnvironments.value = []
  }

  async function copyBetweenServers(sourceId, targetId, envSlug) {
    const response = await webhookApi.copyBetweenServers(sourceId, targetId, { envSlug })
    await loadEnvironments()
    refreshSyncStatus()
    return response.data
  }

  function getSyncStatusFor(entityType, entityId) {
    if (!syncStatus.value) return null
    const map = syncStatus.value[entityType + 's']
    if (!map) return null
    return map[entityId]?.status || null
  }

  function setupSocketListeners() {
    const notificationStore = useNotificationStore()

    socketService.on('environmentCreated', () => loadEnvironments())
    socketService.on('environmentUpdated', () => loadEnvironments())
    socketService.on('environmentDeleted', ({ id }) => {
      if (activeEnvironmentId.value === id) {
        activeEnvironment.value = null
        activeRoute.value = null
        routeLogs.value = []
      }
      loadEnvironments()
    })

    socketService.on('mockRequestReceived', ({ environmentId, routeId, requestLog }) => {
      if (activeRouteId.value === routeId) {
        routeLogs.value.unshift(requestLog)
      }
      notificationStore.showToast('New mock request received', 'info')
    })

    socketService.on('webhookResultUpdated', ({ routeId, requestLog }) => {
      if (activeRouteId.value === routeId) {
        const idx = routeLogs.value.findIndex(l => l.id === requestLog.id)
        if (idx !== -1) {
          routeLogs.value[idx] = requestLog
        }
      }
    })
  }

  async function initialize() {
    const savedServerId = localStorage.getItem('mockhub_activeServerId')
    if (savedServerId) {
      activeSyncServerId.value = Number(savedServerId)
    }
    await webhookApi.setActiveServer(activeSyncServerId.value)
    await loadEnvironments()
    await loadServers()
    if (activeSyncServerId.value) {
      const server = servers.value.find(s => s.id === activeSyncServerId.value)
      if (server) {
        activeServer.value = server
        loadSyncStatus(activeSyncServerId.value)
      } else {
        activeSyncServerId.value = null
        localStorage.removeItem('mockhub_activeServerId')
      }
    }
    setupSocketListeners()
  }

  return {
    environments, activeEnvironment, activeRoute, routeLogs, loading,
    servers, activeServer,
    activeEnvironmentId, activeRouteId,
    initialize, loadEnvironments, selectEnvironment,
    createEnvironment, updateEnvironment, deleteEnvironment,
    createGroup, updateGroup, deleteGroup,
    createRoute, selectRoute, updateRoute, deleteRoute,
    createRule, updateRule, deleteRule,
    loadRouteLogs, clearRouteLogs,
    exportEnvironment, importEnvironment, copyEnvironmentToServer, copyGroupTo, copyRouteTo,
    loadServers, createServer, updateServer, deleteServer,
    testServerConnection, getServerEnvironments,
    pullFromServer, pushToServer, pushGroupToServer, pushRouteToServer, setActiveServer,
    syncStatus, activeSyncServerId, loadSyncStatus, clearSyncStatus, refreshSyncStatus, copyBetweenServers, getSyncStatusFor,
    selectRemoteServer, selectLocalServer
  }
})
