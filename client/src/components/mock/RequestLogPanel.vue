<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-sm font-medium text-gray-700">Captured Requests</h3>
      <button
        v-if="mockStore.routeLogs.length > 0"
        @click="clearLogs"
        class="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
      >
        Clear All
      </button>
    </div>

    <div v-if="mockStore.routeLogs.length === 0" class="text-center py-8">
      <p class="text-gray-400 text-sm">No requests captured yet</p>
    </div>

    <div v-else class="space-y-3">
      <div v-for="log in mockStore.routeLogs" :key="log.id" class="border border-gray-200 rounded-lg">
        <div class="flex items-center justify-between px-4 py-2.5 bg-gray-50 rounded-t-lg cursor-pointer" @click="toggleLog(log.id)">
          <div class="flex items-center space-x-3">
            <span class="text-xs font-bold" :class="methodColor(log.method)">{{ log.method }}</span>
            <span class="text-xs font-mono text-gray-600 truncate max-w-xs">{{ log.path }}</span>
            <span class="px-1.5 py-0.5 text-xs rounded" :class="statusBadge(log.responseStatus)">{{ log.responseStatus }}</span>
          </div>
          <span class="text-xs text-gray-400">{{ formatTime(log.timestamp) }}</span>
        </div>
        <div v-if="expandedLogs.has(log.id)" class="p-4 border-t border-gray-200 space-y-3">
          <div>
            <p class="text-xs font-medium text-gray-500 mb-1">Headers</p>
            <pre class="text-xs bg-gray-100 rounded p-2 overflow-auto max-h-32">{{ JSON.stringify(log.headers, null, 2) }}</pre>
          </div>
          <div v-if="log.queryParams">
            <p class="text-xs font-medium text-gray-500 mb-1">Query Params</p>
            <pre class="text-xs bg-gray-100 rounded p-2 overflow-auto max-h-32">{{ JSON.stringify(log.queryParams, null, 2) }}</pre>
          </div>
          <div v-if="log.body">
            <p class="text-xs font-medium text-gray-500 mb-1">Body</p>
            <pre class="text-xs bg-gray-100 rounded p-2 overflow-auto max-h-32">{{ JSON.stringify(log.body, null, 2) }}</pre>
          </div>
          <div v-if="log.responseBody">
            <p class="text-xs font-medium text-gray-500 mb-1">Response Body</p>
            <pre class="text-xs bg-blue-50 rounded p-2 overflow-auto max-h-32">{{ log.responseBody }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const expandedLogs = ref(new Set())

function toggleLog(id) {
  if (expandedLogs.value.has(id)) {
    expandedLogs.value.delete(id)
  } else {
    expandedLogs.value.add(id)
  }
}

function methodColor(method) {
  const colors = { GET: 'text-green-600', POST: 'text-blue-600', PUT: 'text-amber-600', DELETE: 'text-red-600' }
  return colors[method] || 'text-gray-600'
}

function statusBadge(status) {
  if (status >= 200 && status < 300) return 'bg-green-100 text-green-700'
  if (status >= 400 && status < 500) return 'bg-amber-100 text-amber-700'
  if (status >= 500) return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString()
}

function clearLogs() {
  Swal.fire({
    title: 'Clear all logs?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Clear',
    preConfirm: async () => {
      await mockStore.clearRouteLogs(mockStore.activeRoute.id)
      notificationStore.showToast('Logs cleared', 'success')
    }
  })
}
</script>
