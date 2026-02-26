<template>
  <div>
    <div class="flex justify-between items-center mb-4">
      <h3 class="text-sm font-medium text-gray-700">Captured Requests</h3>
      <div class="flex items-center space-x-3">
        <div class="flex items-center space-x-1.5 text-xs text-gray-500">
          <span>Format:</span>
          <select v-model="displayFormat" class="px-1.5 py-0.5 text-xs border border-gray-300 rounded">
            <option value="auto">Auto</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
          </select>
        </div>
        <button
          v-if="mockStore.routeLogs.length > 0"
          @click="clearLogs"
          class="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition"
        >
          Clear All
        </button>
      </div>
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
            <span v-if="log.webhookSent" class="px-1.5 py-0.5 text-xs rounded font-medium" :class="log.webhookError ? 'bg-red-100 text-red-700' : 'bg-indigo-100 text-indigo-700'">
              Webhook {{ log.webhookResponseStatus || '!' }}
            </span>
          </div>
          <span class="text-xs text-gray-400">{{ formatTime(log.timestamp) }}</span>
        </div>
        <div v-if="expandedLogs.has(log.id)" class="p-4 border-t border-gray-200 space-y-3">
          <div>
            <p class="text-xs font-medium text-gray-500 mb-1">Headers</p>
            <SyntaxHighlighter :content="log.headers" format="json" max-height="max-h-32" />
          </div>
          <div v-if="log.queryParams">
            <p class="text-xs font-medium text-gray-500 mb-1">Query Params</p>
            <SyntaxHighlighter :content="log.queryParams" format="json" max-height="max-h-32" />
          </div>
          <div v-if="log.body">
            <p class="text-xs font-medium text-gray-500 mb-1">Request Body</p>
            <SyntaxHighlighter :content="log.body" :format="displayFormat" max-height="max-h-32" />
          </div>
          <div v-if="log.responseBody">
            <p class="text-xs font-medium text-gray-500 mb-1">Response Body</p>
            <SyntaxHighlighter :content="log.responseBody" :format="displayFormat" bg="blue" max-height="max-h-48" />
          </div>

          <!-- Webhook Callback Details -->
          <div v-if="log.webhookSent" class="mt-3 pt-3 border-t border-indigo-200">
            <p class="text-xs font-semibold text-indigo-600 mb-2">Webhook Callback</p>

            <div v-if="log.webhookError" class="mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              Error: {{ log.webhookError }}
            </div>

            <div class="mb-2">
              <p class="text-xs font-medium text-gray-500 mb-1">Request</p>
              <div class="flex items-center space-x-2 mb-1">
                <span class="text-xs font-bold text-indigo-600">{{ log.webhookMethod }}</span>
                <span class="text-xs font-mono text-gray-600 truncate">{{ log.webhookUrl }}</span>
              </div>
            </div>

            <div v-if="log.webhookRequestHeaders">
              <p class="text-xs font-medium text-gray-500 mb-1">Webhook Request Headers</p>
              <SyntaxHighlighter :content="log.webhookRequestHeaders" format="json" max-height="max-h-24" />
            </div>

            <div v-if="log.webhookRequestBody" class="mt-2">
              <p class="text-xs font-medium text-gray-500 mb-1">Webhook Request Body</p>
              <SyntaxHighlighter :content="log.webhookRequestBody" :format="displayFormat" max-height="max-h-32" />
            </div>

            <div v-if="log.webhookResponseStatus" class="mt-2">
              <p class="text-xs font-medium text-gray-500 mb-1">
                Webhook Response
                <span class="ml-1 px-1.5 py-0.5 rounded" :class="statusBadge(log.webhookResponseStatus)">{{ log.webhookResponseStatus }}</span>
              </p>
            </div>

            <div v-if="log.webhookResponseHeaders" class="mt-2">
              <p class="text-xs font-medium text-gray-500 mb-1">Webhook Response Headers</p>
              <SyntaxHighlighter :content="log.webhookResponseHeaders" format="json" max-height="max-h-24" />
            </div>

            <div v-if="log.webhookResponseBody" class="mt-2">
              <p class="text-xs font-medium text-gray-500 mb-1">Webhook Response Body</p>
              <SyntaxHighlighter :content="log.webhookResponseBody" :format="displayFormat" bg="blue" max-height="max-h-48" />
            </div>
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
import SyntaxHighlighter from './SyntaxHighlighter.vue'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const expandedLogs = ref(new Set())
const displayFormat = ref('auto')

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
