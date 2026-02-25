<template>
  <div class="flex h-screen overflow-hidden">
    <EnvironmentSidebar />

    <div class="flex-1 flex flex-col overflow-hidden">
      <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 class="text-lg font-semibold text-gray-900">MockHub</h1>
          <p class="text-xs text-gray-500">API Mock Server</p>
        </div>
        <div class="flex items-center space-x-3">
          <button @click="showImportModal = true" class="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            Import
          </button>
          <button @click="showCreateEnvModal = true" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
            + Environment
          </button>
        </div>
      </header>

      <main class="flex-1 overflow-y-auto p-6">
        <RouteDetail v-if="mockStore.activeRoute" />
        <div v-else-if="mockStore.activeEnvironment" class="text-center py-20">
          <p class="text-gray-500 text-lg">Select a route from the sidebar</p>
        </div>
        <div v-else class="text-center py-20">
          <p class="text-gray-400 text-lg">Select or create an environment to get started</p>
        </div>
      </main>
    </div>

    <CreateEnvironmentModal v-if="showCreateEnvModal" @close="showCreateEnvModal = false" />
    <ImportModal v-if="showImportModal" @close="showImportModal = false" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useMockStore } from '@/stores/mockStore'
import EnvironmentSidebar from '@/components/mock/EnvironmentSidebar.vue'
import RouteDetail from '@/components/mock/RouteDetail.vue'
import CreateEnvironmentModal from '@/components/mock/CreateEnvironmentModal.vue'
import ImportModal from '@/components/mock/ImportModal.vue'

const route = useRoute()
const mockStore = useMockStore()
const showCreateEnvModal = ref(false)
const showImportModal = ref(false)

onMounted(async () => {
  await mockStore.initialize()
  if (route.params.envId) {
    await mockStore.selectEnvironment(parseInt(route.params.envId))
    if (route.params.routeId) {
      await mockStore.selectRoute(parseInt(route.params.routeId))
    }
  }
})

watch(() => route.params, async (params) => {
  if (params.envId && parseInt(params.envId) !== mockStore.activeEnvironmentId) {
    await mockStore.selectEnvironment(parseInt(params.envId))
  }
  if (params.routeId && parseInt(params.routeId) !== mockStore.activeRouteId) {
    await mockStore.selectRoute(parseInt(params.routeId))
  }
}, { deep: true })
</script>
