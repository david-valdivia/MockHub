<template>
  <div class="space-y-6">
    <!-- Route Header -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <span class="px-2.5 py-1 text-xs font-bold rounded" :class="methodBadge(mockStore.activeRoute.method)">
            {{ mockStore.activeRoute.method }}
          </span>
          <span class="text-lg font-mono text-gray-800">{{ mockStore.activeRoute.pathPattern }}</span>
        </div>
        <button @click="confirmDeleteRoute" class="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition">
          Delete Route
        </button>
      </div>
    </div>

    <!-- Tabs -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200">
      <div class="border-b border-gray-200">
        <nav class="flex px-6 -mb-px">
          <button
            :class="activeTab === 'rules' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
            class="px-4 py-3 border-b-2 font-medium text-sm mr-8"
            @click="activeTab = 'rules'"
          >
            Rules ({{ mockStore.activeRoute.rules?.length || 0 }})
          </button>
          <button
            :class="activeTab === 'logs' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'"
            class="px-4 py-3 border-b-2 font-medium text-sm"
            @click="activeTab = 'logs'"
          >
            Request Logs ({{ mockStore.routeLogs.length }})
          </button>
        </nav>
      </div>

      <div class="p-6">
        <!-- Rules Tab -->
        <div v-if="activeTab === 'rules'">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-sm font-medium text-gray-700">Response Rules (evaluated top to bottom)</h3>
            <button @click="addRule" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              + Add Rule
            </button>
          </div>
          <div class="space-y-4">
            <RuleEditor
              v-for="rule in mockStore.activeRoute.rules" :key="rule.id"
              :rule="rule"
            />
          </div>
          <div v-if="!mockStore.activeRoute.rules?.length" class="text-center py-8">
            <p class="text-gray-400">No rules configured</p>
          </div>
        </div>

        <!-- Logs Tab -->
        <div v-else-if="activeTab === 'logs'">
          <RequestLogPanel />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import RuleEditor from './RuleEditor.vue'
import RequestLogPanel from './RequestLogPanel.vue'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const activeTab = ref('rules')

function methodBadge(method) {
  const badges = {
    GET: 'bg-green-100 text-green-700', POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700', PATCH: 'bg-purple-100 text-purple-700',
    DELETE: 'bg-red-100 text-red-700', ALL: 'bg-gray-100 text-gray-700'
  }
  return badges[method] || 'bg-gray-100 text-gray-700'
}

async function addRule() {
  try {
    await mockStore.createRule(mockStore.activeRoute.id, {
      priority: (mockStore.activeRoute.rules?.length || 0),
      conditions: [],
      status_code: 200,
      content_type: 'application/json',
      body: '{"message":"OK"}',
      delay: 0
    })
    notificationStore.showToast('Rule added', 'success')
  } catch (error) {
    notificationStore.showToast('Failed to add rule', 'error')
  }
}

function confirmDeleteRoute() {
  Swal.fire({
    title: 'Delete route?',
    text: 'This will delete this route and all its rules.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Delete',
    preConfirm: async () => {
      await mockStore.deleteRoute(mockStore.activeRoute.id)
    }
  })
}
</script>
