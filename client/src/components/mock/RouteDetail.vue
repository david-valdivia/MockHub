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
            <div class="flex items-center space-x-2">
              <button v-if="mockStore.activeRoute.rules?.length" @click="copyAllRules" class="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition flex items-center space-x-1">
                <ClipboardDocumentIcon class="h-3.5 w-3.5" />
                <span>Copy Rules</span>
              </button>
              <button @click="showBulkRules = !showBulkRules" class="px-3 py-1.5 text-sm text-purple-600 border border-purple-300 rounded-lg hover:bg-purple-50 transition">
                Bulk Add Rules
              </button>
              <button @click="addRule" class="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
                + Add Rule
              </button>
            </div>
          </div>

          <!-- Bulk Rules Import Panel -->
          <div v-if="showBulkRules" class="mb-4 p-4 border border-purple-200 bg-purple-50 rounded-lg space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-sm font-medium text-purple-700">Bulk Add Rules</h4>
              <div class="flex items-center space-x-2">
                <button @click="copyAIInstructions" class="px-2.5 py-1 text-xs text-purple-700 border border-purple-300 rounded hover:bg-purple-100 transition flex items-center space-x-1" title="Copy instructions to give to AI for generating rules">
                  <ClipboardDocumentIcon class="h-3 w-3" />
                  <span>Copy AI Instructions</span>
                </button>
                <button @click="showBulkRules = false; bulkRulesText = ''" class="text-xs text-gray-500 hover:text-gray-700">Close</button>
              </div>
            </div>
            <p class="text-xs text-gray-600">
              Paste a JSON array of rules. Use <strong>Copy AI Instructions</strong> to get a prompt you can give to any AI to generate rules for this route.
            </p>
            <textarea v-model="bulkRulesText" rows="8" class="w-full px-3 py-2 text-xs font-mono border border-purple-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" placeholder="Paste JSON array of rules here..."></textarea>
            <div class="flex items-center space-x-2">
              <button @click="applyBulkRules" class="px-4 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">
                Import Rules
              </button>
              <span class="text-xs text-gray-500">This will add new rules (existing rules are not affected)</span>
            </div>
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
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import RuleEditor from './RuleEditor.vue'
import RequestLogPanel from './RequestLogPanel.vue'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const activeTab = ref('rules')
const showBulkRules = ref(false)
const bulkRulesText = ref('')

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

function copyAllRules() {
  const rules = (mockStore.activeRoute.rules || []).map(r => ({
    priority: r.priority,
    conditions: r.conditions || [],
    status_code: r.statusCode,
    content_type: r.contentType,
    body: r.body,
    delay: r.delay
  }))
  const json = JSON.stringify(rules, null, 2)
  navigator.clipboard.writeText(json)
    .then(() => notificationStore.showToast('Rules copied to clipboard', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
}

async function applyBulkRules() {
  try {
    const parsed = JSON.parse(bulkRulesText.value)
    if (!Array.isArray(parsed)) throw new Error('Must be a JSON array')
    if (parsed.length === 0) throw new Error('Array is empty')

    const routeId = mockStore.activeRoute.id
    const existingCount = mockStore.activeRoute.rules?.length || 0
    let created = 0

    for (let i = 0; i < parsed.length; i++) {
      const r = parsed[i]
      await mockStore.createRule(routeId, {
        priority: r.priority ?? (existingCount + i),
        conditions: r.conditions || [],
        status_code: r.status_code || 200,
        content_type: r.content_type || 'application/json',
        body: r.body || '{"message":"OK"}',
        delay: r.delay || 0
      })
      created++
    }

    showBulkRules.value = false
    bulkRulesText.value = ''
    notificationStore.showToast(`${created} rules imported`, 'success')
  } catch (e) {
    notificationStore.showToast('Error: ' + e.message, 'error')
  }
}

function copyAIInstructions() {
  const route = mockStore.activeRoute
  const existingRules = (route.rules || []).map(r => ({
    priority: r.priority,
    conditions: r.conditions || [],
    status_code: r.statusCode,
    content_type: r.contentType,
    body: r.body,
    delay: r.delay
  }))

  const instructions = `Generate mock API rules for my mock server. Return ONLY a JSON array, no explanation.

ROUTE: ${route.method} ${route.pathPattern}

RULE FORMAT:
[
  {
    "priority": <number>,       // lower = evaluated first
    "conditions": [             // ALL must match (AND logic). Empty array = always matches (default rule)
      {
        "field": "<path>",      // dot-notation: headers.authorization, body.email, query.page, params.id
        "operator": "<op>",     // equals, not_equals, contains, not_contains, exists, not_exists, gt, gte, lt, lte, matches (regex), exists_in_logs (value already seen in previous requests), not_exists_in_logs
        "value": "<value>"      // omit for exists/not_exists
      }
    ],
    "status_code": <number>,    // HTTP status code
    "content_type": "<mime>",   // application/json, text/plain, application/xml, text/html
    "body": "<string>",         // response body (JSON must be escaped string). Supports template variables: {{params.id}}, {{body.field}}, {{query.param}}, {{headers.x}}, {{$timestamp}}, {{$uuid}}
    "delay": <ms>               // response delay in milliseconds
  }
]${existingRules.length > 0 ? `

EXISTING RULES (for reference):
${JSON.stringify(existingRules, null, 2)}` : ''}

Generate rules for the following scenarios:
`

  navigator.clipboard.writeText(instructions)
    .then(() => notificationStore.showToast('AI instructions copied! Paste to your AI and describe the scenarios you need.', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
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
