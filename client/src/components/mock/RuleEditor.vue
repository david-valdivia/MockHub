<template>
  <div class="border border-gray-200 rounded-lg">
    <!-- Rule Header -->
    <div
      class="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="flex items-center space-x-3">
        <span class="text-xs font-medium text-gray-500">Priority {{ rule.priority }}</span>
        <span class="px-2 py-0.5 text-xs rounded" :class="rule.conditions?.length ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">
          {{ rule.conditions?.length ? `${rule.conditions.length} condition(s)` : 'Default' }}
        </span>
        <span class="text-xs text-gray-500">&rarr; {{ rule.statusCode }}</span>
      </div>
      <div class="flex items-center space-x-2">
        <button @click.stop="confirmDeleteRule" class="p-1 text-gray-400 hover:text-red-600 transition">
          <TrashIcon class="h-4 w-4" />
        </button>
        <ChevronDownIcon class="h-4 w-4 text-gray-400 transition-transform" :class="{ 'rotate-180': expanded }" />
      </div>
    </div>

    <!-- Rule Body (expanded) -->
    <div v-if="expanded" class="p-4 space-y-4 border-t border-gray-200">
      <!-- Priority -->
      <div class="grid grid-cols-3 gap-4">
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Priority <span class="text-gray-400 font-normal">(lower = first)</span></label>
          <input type="number" v-model.number="form.priority" min="0" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Status Code</label>
          <input type="number" v-model.number="form.status_code" min="100" max="599" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label class="block text-xs font-medium text-gray-600 mb-1">Delay (ms)</label>
          <input type="number" v-model.number="form.delay" min="0" max="30000" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
        </div>
      </div>

      <!-- Content Type -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Content-Type</label>
        <select v-model="form.content_type" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
          <option value="application/json">application/json</option>
          <option value="text/plain">text/plain</option>
          <option value="text/html">text/html</option>
          <option value="application/xml">application/xml</option>
        </select>
      </div>

      <!-- Conditions -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-medium text-gray-600">Conditions (all must match)</label>
          <div class="flex items-center space-x-2">
            <button v-if="form.conditions.length > 0" @click="copyConditions" class="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1" title="Copy conditions as JSON">
              <ClipboardDocumentIcon class="h-3 w-3" />
              <span>Copy</span>
            </button>
            <button @click="showBulkConditions = !showBulkConditions" class="text-xs text-purple-600 hover:text-purple-700">Bulk Import</button>
            <button @click="addCondition" class="text-xs text-blue-600 hover:text-blue-700">+ Add Condition</button>
          </div>
        </div>
        <div v-if="showBulkConditions" class="mb-2 space-y-2">
          <p class="text-xs text-gray-400">Paste a JSON array of conditions, e.g.:<br><code class="text-purple-500">[{"field":"headers.authorization","operator":"exists"},{"field":"body.amount","operator":"gt","value":"100"}]</code></p>
          <textarea v-model="bulkConditionsText" rows="4" class="w-full px-3 py-2 text-xs font-mono border border-purple-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" placeholder='[{"field":"...","operator":"equals","value":"..."}]'></textarea>
          <div class="flex items-center space-x-2">
            <button @click="applyBulkConditions" class="px-3 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition">Apply</button>
            <button @click="showBulkConditions = false; bulkConditionsText = ''" class="px-3 py-1 text-xs text-gray-500 border border-gray-300 rounded hover:bg-gray-50 transition">Cancel</button>
          </div>
        </div>
        <ConditionBuilder v-model="form.conditions" />
      </div>

      <!-- Body -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <label class="text-xs font-medium text-gray-600">Response Body <span class="text-gray-400">(supports &#123;&#123;params.id&#125;&#125;, &#123;&#123;$uuid&#125;&#125;, etc.)</span></label>
          <button @click="beautifyBody" class="text-xs text-blue-600 hover:text-blue-700">Beautify</button>
        </div>
        <textarea v-model="form.body" rows="6" class="w-full px-3 py-2 text-sm font-mono border border-gray-300 rounded-lg"></textarea>
      </div>

      <!-- Save -->
      <div class="flex justify-end">
        <button @click="saveRule" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
          {{ saving ? 'Saving...' : 'Save Rule' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { TrashIcon, ChevronDownIcon, ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import ConditionBuilder from './ConditionBuilder.vue'
import Swal from 'sweetalert2'

const props = defineProps({ rule: Object })
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const expanded = ref(false)
const saving = ref(false)
const showBulkConditions = ref(false)
const bulkConditionsText = ref('')

const form = reactive({
  priority: props.rule.priority,
  status_code: props.rule.statusCode,
  content_type: props.rule.contentType,
  body: props.rule.body,
  delay: props.rule.delay,
  conditions: [...(props.rule.conditions || [])]
})

watch(() => props.rule, (r) => {
  form.priority = r.priority
  form.status_code = r.statusCode
  form.content_type = r.contentType
  form.body = r.body
  form.delay = r.delay
  form.conditions = [...(r.conditions || [])]
}, { deep: true })

function addCondition() {
  form.conditions.push({ field: '', operator: 'equals', value: '' })
}

function copyConditions() {
  const json = JSON.stringify(form.conditions, null, 2)
  navigator.clipboard.writeText(json)
    .then(() => notificationStore.showToast('Conditions copied', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
}

function applyBulkConditions() {
  try {
    const parsed = JSON.parse(bulkConditionsText.value)
    if (!Array.isArray(parsed)) throw new Error('Must be an array')
    for (const c of parsed) {
      if (!c.field || !c.operator) throw new Error('Each condition needs field and operator')
    }
    form.conditions = parsed.map(c => ({
      field: c.field,
      operator: c.operator,
      value: c.value || ''
    }))
    showBulkConditions.value = false
    bulkConditionsText.value = ''
    notificationStore.showToast(`${parsed.length} conditions imported`, 'success')
  } catch (e) {
    notificationStore.showToast('Invalid JSON: ' + e.message, 'error')
  }
}

function beautifyBody() {
  const text = form.body.trim()
  if (!text) return

  // Try JSON
  try {
    const parsed = JSON.parse(text)
    form.body = JSON.stringify(parsed, null, 2)
    notificationStore.showToast('JSON formatted', 'success')
    return
  } catch (e) {}

  // Try XML - basic indent
  if (text.startsWith('<')) {
    let formatted = ''
    let indent = 0
    const tags = text.replace(/>\s*</g, '><').split(/(<[^>]+>)/).filter(Boolean)
    for (const tag of tags) {
      if (tag.match(/^<\/\w/)) indent--
      formatted += '  '.repeat(Math.max(0, indent)) + tag.trim() + '\n'
      if (tag.match(/^<\w[^/]*[^/]>$/)) indent++
    }
    form.body = formatted.trim()
    notificationStore.showToast('XML formatted', 'success')
    return
  }

  notificationStore.showToast('Could not detect format', 'info')
}

async function saveRule() {
  try {
    saving.value = true
    await mockStore.updateRule(props.rule.id, form)
    notificationStore.showToast('Rule saved', 'success')
  } catch (error) {
    notificationStore.showToast('Failed to save rule', 'error')
  } finally {
    saving.value = false
  }
}

function confirmDeleteRule() {
  Swal.fire({
    title: 'Delete rule?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Delete',
    preConfirm: async () => {
      await mockStore.deleteRule(props.rule.id)
    }
  })
}
</script>
