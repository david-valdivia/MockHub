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

  const activeEnvironmentId = computed(() => activeEnvironment.value?.id || null)
  const activeRouteId = computed(() => activeRoute.value?.id || null)

  async function loadEnvironments() {
    try {
      loading.value = true
      const response = await webhookApi.getEnvironments()
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
    const response = await webhookApi.createEnvironment(data)
    await loadEnvironments()
    return response.data
  }

  async function updateEnvironment(id, data) {
    const response = await webhookApi.updateEnvironment(id, data)
    if (activeEnvironmentId.value === id) {
      await selectEnvironment(id)
    }
    await loadEnvironments()
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
  }

  async function createGroup(envId, data) {
    const response = await webhookApi.createGroup(envId, data)
    if (activeEnvironmentId.value === envId) {
      await selectEnvironment(envId)
    }
    return response.data
  }

  async function deleteGroup(id) {
    await webhookApi.deleteGroup(id)
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
  }

  async function createRoute(groupId, data) {
    const response = await webhookApi.createRoute(groupId, data)
    if (activeEnvironment.value) {
      await selectEnvironment(activeEnvironment.value.id)
    }
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
  }

  async function createRule(routeId, data) {
    const response = await webhookApi.createRule(routeId, data)
    if (activeRouteId.value === routeId) {
      await selectRoute(routeId)
    }
    return response.data
  }

  async function updateRule(id, data) {
    const response = await webhookApi.updateRule(id, data)
    if (activeRoute.value) {
      await selectRoute(activeRoute.value.id)
    }
    return response.data
  }

  async function deleteRule(id) {
    await webhookApi.deleteRule(id)
    if (activeRoute.value) {
      await selectRoute(activeRoute.value.id)
    }
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

  async function exportEnvironment(id) {
    const response = await webhookApi.exportEnvironment(id)
    return response.data
  }

  async function importEnvironment(data) {
    const response = await webhookApi.importEnvironment(data)
    await loadEnvironments()
    return response.data
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
    await loadEnvironments()
    setupSocketListeners()
  }

  return {
    environments, activeEnvironment, activeRoute, routeLogs, loading,
    activeEnvironmentId, activeRouteId,
    initialize, loadEnvironments, selectEnvironment,
    createEnvironment, updateEnvironment, deleteEnvironment,
    createGroup, deleteGroup,
    createRoute, selectRoute, updateRoute, deleteRoute,
    createRule, updateRule, deleteRule,
    loadRouteLogs, clearRouteLogs,
    exportEnvironment, importEnvironment
  }
})
