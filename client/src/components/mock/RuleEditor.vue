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
          <label class="text-xs font-medium text-gray-600">Response Body</label>
          <div class="flex items-center space-x-2">
            <button @click="showTagPanel = !showTagPanel" class="text-xs flex items-center space-x-1" :class="showTagPanel ? 'text-rose-600' : 'text-rose-500 hover:text-rose-600'">
              <CodeBracketIcon class="h-3 w-3" />
              <span>Insert Tag</span>
            </button>
            <button @click="beautifyBody" class="text-xs text-blue-600 hover:text-blue-700">Beautify</button>
          </div>
        </div>

        <!-- Tag Reference Panel -->
        <div v-if="showTagPanel" class="mb-2 border border-rose-200 bg-rose-50 rounded-lg p-3 space-y-2.5">
          <div v-for="cat in tagCategories" :key="cat.label">
            <p class="text-xs font-semibold text-gray-600 mb-1">{{ cat.label }}</p>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="tag in cat.tags" :key="tag.value"
                @click="insertTag(tag.value)"
                @mouseenter="showTooltip($event, tag)"
                @mouseleave="hideTooltip"
                class="px-2 py-0.5 text-xs font-mono rounded border transition"
                :class="tag.color || 'bg-white border-rose-200 text-rose-700 hover:bg-rose-100'"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="relative border border-gray-300 rounded-lg overflow-hidden">
          <div
            ref="highlightRef"
            class="px-3 py-2 text-sm font-mono whitespace-pre-wrap break-all overflow-auto bg-gray-50"
            style="max-height: 500px; min-height: 80px;"
            v-html="bodyHighlighted"
            aria-hidden="true"
          ></div>
          <textarea
            ref="textareaRef"
            v-model="form.body"
            @input="syncScroll"
            @scroll="syncScroll"
            class="absolute inset-0 w-full h-full px-3 py-2 text-sm font-mono whitespace-pre-wrap break-all overflow-auto bg-transparent resize-none border-none outline-none"
            style="color: transparent; caret-color: #1f2937;"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- Save -->
      <div class="flex justify-end">
        <button @click="saveRule" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
          {{ saving ? 'Saving...' : 'Save Rule' }}
        </button>
      </div>
    </div>

    <!-- Tooltip (teleported to body so it's above everything) -->
    <Teleport to="body">
      <div
        v-if="tooltip.visible"
        class="fixed px-2.5 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg pointer-events-none whitespace-nowrap"
        :style="{ top: tooltip.y + 'px', left: tooltip.x + 'px', zIndex: 99999, transform: 'translate(-50%, -100%)' }"
      >
        <p class="font-medium">{{ tooltip.desc }}</p>
        <p v-if="tooltip.example" class="text-gray-400 font-mono mt-0.5">{{ tooltip.example }}</p>
        <div class="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, nextTick } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { TrashIcon, ChevronDownIcon, ClipboardDocumentIcon, CodeBracketIcon } from '@heroicons/vue/24/outline'
import ConditionBuilder from './ConditionBuilder.vue'
import Swal from 'sweetalert2'

const props = defineProps({ rule: Object })
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const expanded = ref(false)
const saving = ref(false)
const showBulkConditions = ref(false)
const bulkConditionsText = ref('')
const highlightRef = ref(null)
const textareaRef = ref(null)
const showTagPanel = ref(false)
const tooltip = reactive({ visible: false, x: 0, y: 0, desc: '', example: '' })

function showTooltip(event, tag) {
  const rect = event.target.getBoundingClientRect()
  tooltip.x = rect.left + rect.width / 2
  tooltip.y = rect.top - 8
  tooltip.desc = tag.desc
  tooltip.example = tag.example || ''
  tooltip.visible = true
}

function hideTooltip() {
  tooltip.visible = false
}

const tagCategories = [
  {
    label: 'Request Data',
    tags: [
      { label: '{{body.*}}', value: '{{body.}}', desc: 'Request body field (dot-notation)', example: '{{body.email}} → user@test.com', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
      { label: '{{params.*}}', value: '{{params.}}', desc: 'URL path parameter from :param', example: '/users/:id → {{params.id}} → 42', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
      { label: '{{query.*}}', value: '{{query.}}', desc: 'Query string parameter', example: '?page=3 → {{query.page}} → 3', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
      { label: '{{headers.*}}', value: '{{headers.}}', desc: 'Request header value', example: '{{headers.authorization}} → Bearer xxx', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
      { label: '{{method}}', value: '{{method}}', desc: 'HTTP method of the request', example: '{{method}} → POST', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
    ]
  },
  {
    label: 'Identifiers',
    tags: [
      { label: '{{$uuid}}', value: '{{$uuid}}', desc: 'Random UUID v4', example: '→ 550e8400-e29b-41d4-a716-446655440000' },
      { label: '{{$randomInt}}', value: '{{$randomInt}}', desc: 'Random integer 0-999999', example: '→ 847293' },
      { label: '{{$randomFloat}}', value: '{{$randomFloat}}', desc: 'Random float with 2 decimals', example: '→ 482.37' },
      { label: '{{$randomString:N}}', value: '{{$randomString:16}}', desc: 'Random hex string of N chars', example: '→ a3f8c2e1b9d04f67' },
      { label: '{{$seq}}', value: '{{$seq}}', desc: 'Auto-incrementing counter per request', example: '→ 1, 2, 3...' },
    ]
  },
  {
    label: 'Date & Time',
    tags: [
      { label: '{{$timestamp}}', value: '{{$timestamp}}', desc: 'ISO 8601 full datetime', example: '→ 2026-02-25T14:30:00.000Z', color: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50' },
      { label: '{{$isoDate}}', value: '{{$isoDate}}', desc: 'ISO 8601 datetime (alias)', example: '→ 2026-02-25T14:30:00.000Z', color: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50' },
      { label: '{{$date}}', value: '{{$date}}', desc: 'Date only YYYY-MM-DD', example: '→ 2026-02-25', color: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50' },
      { label: '{{$time}}', value: '{{$time}}', desc: 'Time only HH:MM:SS', example: '→ 14:30:00', color: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50' },
      { label: '{{$now}}', value: '{{$now}}', desc: 'Unix timestamp in milliseconds', example: '→ 1772150400000', color: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50' },
    ]
  },
  {
    label: 'Random Data',
    tags: [
      { label: '{{$randomBool}}', value: '{{$randomBool}}', desc: 'Random true or false', example: '→ true', color: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50' },
      { label: '{{$randomEmail}}', value: '{{$randomEmail}}', desc: 'Random email address', example: '→ user48271@example.com', color: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50' },
      { label: '{{$randomName}}', value: '{{$randomName}}', desc: 'Random first name from a preset list', example: '→ Alice, Carlos, Diana...', color: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50' },
      { label: '{{$enum:a,b,c}}', value: '{{$enum:option1,option2,option3}}', desc: 'Random pick from your comma-separated values', example: '{{$enum:active,pending,closed}} → pending', color: 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50' },
    ]
  },
  {
    label: 'Previous Log (when exists_in_logs matches)',
    tags: [
      { label: '{{logs.body.*}}', value: '{{logs.body.}}', desc: 'Body field from the last matching log', example: '{{logs.body.email}} → prev request email', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.headers.*}}', value: '{{logs.headers.}}', desc: 'Header from the last matching log', example: '{{logs.headers.user-agent}} → prev UA', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.queryParams.*}}', value: '{{logs.queryParams.}}', desc: 'Query param from the last matching log', example: '{{logs.queryParams.page}} → 2', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.responseBody}}', value: '{{logs.responseBody}}', desc: 'Full response body sent in the previous match', example: '→ {"status":"created",...}', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.responseStatus}}', value: '{{logs.responseStatus}}', desc: 'HTTP status returned in the previous match', example: '→ 200', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.timestamp}}', value: '{{logs.timestamp}}', desc: 'When the previous matching request was received', example: '→ 2026-02-25 19:02:39', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.method}}', value: '{{logs.method}}', desc: 'HTTP method of the previous matching request', example: '→ POST', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.path}}', value: '{{logs.path}}', desc: 'Full path of the previous matching request', example: '→ /vyde/leads', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
    ]
  },
  {
    label: 'Advanced',
    tags: [
      { label: 'a|b (fallback)', value: '|', desc: 'Pipe: if left side is null/undefined, try right side. Chain multiple with |', example: '{{logs.body.id|body.id|$uuid}} → tries each', color: 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50' },
      { label: '"literal"', value: '|"default"', desc: 'Quoted literal as final fallback value', example: '{{logs.body.x|"N/A"}} → N/A if no log', color: 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50' },
      { label: '{{$repeat:N:tpl}}', value: '{{$repeat:3:{"id":$i}}}', desc: 'Repeat a template N times. Use $i for index', example: '{{$repeat:2:item_$i}} → item_0,item_1', color: 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50' },
    ]
  }
]

function insertTag(tag) {
  const ta = textareaRef.value
  if (!ta) {
    form.body = (form.body || '') + tag
    return
  }
  ta.focus()
  // Use execCommand to preserve native undo history (Ctrl+Z)
  document.execCommand('insertText', false, tag)
  // For path tags, move cursor before closing }} so user can type field name
  if (tag.endsWith('.}}')) {
    nextTick(() => {
      const pos = ta.selectionStart - 2
      ta.setSelectionRange(pos, pos)
    })
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlightJson(text) {
  return text
    .replace(/("(?:\\.|[^"\\])*")/g, (match) => {
      return `<span class="text-green-700">${match}</span>`
    })
    .replace(/<span class="text-green-700">("(?:\\.|[^"\\])*")<\/span>\s*:/g, (match, key) => {
      return `<span class="text-purple-700">${key}</span>:`
    })
    .replace(/:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, (match, num) => {
      return `: <span class="text-blue-600">${num}</span>`
    })
    .replace(/:\s*(true|false|null)\b/g, (match, val) => {
      return `: <span class="text-amber-600">${val}</span>`
    })
    .replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      return `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`
    })
}

function highlightXml(text) {
  return text
    .replace(/&lt;(\/?)([\w:-]+)/g, (match, slash, tag) => {
      return `&lt;${slash}<span class="text-blue-700 font-semibold">${tag}</span>`
    })
    .replace(/([\w:-]+)=("(?:\\.|[^"\\])*")/g, (match, attr, val) => {
      return `<span class="text-purple-600">${attr}</span>=<span class="text-green-700">${val}</span>`
    })
    .replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      return `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`
    })
}

const bodyHighlighted = computed(() => {
  const raw = form.body || ''
  if (!raw.trim()) return '<span class="text-gray-400 italic">Empty response body</span>'
  const escaped = escapeHtml(raw)
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return highlightJson(escaped)
  if (trimmed.startsWith('<')) return highlightXml(escaped)
  return escaped.replace(/\{\{([^}]+)\}\}/g, (m, expr) => `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`)
})

function syncScroll() {
  if (highlightRef.value && textareaRef.value) {
    highlightRef.value.scrollTop = textareaRef.value.scrollTop
    highlightRef.value.scrollLeft = textareaRef.value.scrollLeft
  }
}

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
