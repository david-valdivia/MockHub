<template>
  <div class="border border-gray-200 rounded-lg">
    <!-- Rule Header -->
    <div
      class="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-t-lg cursor-pointer"
      @click="expanded = !expanded"
    >
      <div class="flex items-center space-x-3 min-w-0">
        <span class="text-gray-300 cursor-grab active:cursor-grabbing select-none flex-shrink-0" title="Drag to reorder">⠿</span>
        <span class="text-xs font-medium text-gray-500 flex-shrink-0">{{ rule.priority }}</span>
        <span v-if="rule.name" class="text-xs font-medium text-gray-700 truncate max-w-[180px]">{{ rule.name }}</span>
        <span class="px-2 py-0.5 text-xs rounded flex-shrink-0" :class="rule.conditions?.length ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'">
          {{ rule.conditions?.length ? `${rule.conditions.length} condition(s)` : 'Default' }}
        </span>
        <span class="text-xs text-gray-500 flex-shrink-0">&rarr; {{ rule.statusCode }}</span>
      </div>
      <div class="flex items-center space-x-2">
        <span v-if="saving" class="flex items-center text-xs text-blue-500" title="Saving...">
          <svg class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        </span>
        <span v-else-if="dirty && !saved" class="flex items-center text-xs text-amber-500" title="Unsaved changes">
          <ExclamationCircleIcon class="h-3.5 w-3.5" />
        </span>
        <span v-else-if="saved && !dirty" class="flex items-center text-xs text-green-500" title="Saved">
          <CheckCircleIcon class="h-3.5 w-3.5" />
        </span>
        <button @click.stop="duplicateRule" class="p-1 text-gray-400 hover:text-blue-600 transition" title="Duplicate rule">
          <DocumentDuplicateIcon class="h-4 w-4" />
        </button>
        <button @click.stop="confirmDeleteRule" class="p-1 text-gray-400 hover:text-red-600 transition" title="Delete rule">
          <TrashIcon class="h-4 w-4" />
        </button>
        <ChevronDownIcon class="h-4 w-4 text-gray-400 transition-transform" :class="{ 'rotate-180': expanded }" />
      </div>
    </div>

    <!-- Rule Body (expanded) -->
    <div v-if="expanded" class="p-4 space-y-4 border-t border-gray-200">
      <!-- Name -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Rule Name <span class="text-gray-400 font-normal">(optional)</span></label>
        <input type="text" v-model="form.name" placeholder="e.g. Create response, Duplicate check, Default fallback..." class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
      </div>

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
          <label class="text-xs font-medium text-gray-600">Conditions <span class="text-gray-400 font-normal">(AND/OR logic)</span></label>
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
        <ConditionBuilder v-model="form.conditions" @change="markDirty" />
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
            <button @click="copyBody" class="text-xs text-gray-500 hover:text-gray-700 flex items-center space-x-1">
              <ClipboardDocumentIcon class="h-3 w-3" />
              <span>Copy</span>
            </button>
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

        <div class="border border-gray-300 rounded-lg overflow-hidden">
          <div
            v-if="!bodyFocused"
            @click="focusBody"
            class="px-3 py-2 text-sm font-mono whitespace-pre-wrap break-words overflow-auto bg-gray-50 cursor-text"
            style="max-height: 500px; min-height: 80px; word-break: break-word; tab-size: 2; line-height: 1.5;"
            v-html="bodyHighlighted"
          ></div>
          <textarea
            v-else
            ref="textareaRef"
            v-model="form.body"
            @blur="onBodyBlur"
            class="w-full px-3 py-2 text-sm font-mono whitespace-pre-wrap break-words overflow-auto bg-gray-50 resize-none border-none outline-none"
            style="max-height: 500px; min-height: 80px; word-break: break-word; tab-size: 2; line-height: 1.5;"
            spellcheck="false"
          ></textarea>
        </div>
      </div>

      <!-- Async Webhook Callback -->
      <div>
        <div class="flex items-center justify-between mb-2">
          <label class="text-xs font-medium text-gray-600 flex items-center space-x-1.5">
            <span>Async Webhook Callback</span>
            <span class="text-gray-400 font-normal">(optional — fires after response is sent)</span>
          </label>
          <div class="flex items-center space-x-2">
            <label v-if="form.webhook_url" class="flex items-center cursor-pointer" title="Enable/disable callback">
              <input type="checkbox" v-model="form.webhook_enabled" class="sr-only peer" />
              <div class="w-7 h-4 bg-gray-300 peer-checked:bg-indigo-500 rounded-full relative transition-colors">
                <div class="absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-3"></div>
              </div>
            </label>
            <button @click="showWebhook = !showWebhook" class="text-xs" :class="showWebhook || form.webhook_url ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'">
              {{ showWebhook ? 'Hide' : (form.webhook_url ? 'Edit Callback' : '+ Add Callback') }}
            </button>
          </div>
        </div>
        <!-- Webhook summary when collapsed but configured -->
        <div v-if="!showWebhook && form.webhook_url" class="px-3 py-2 rounded-lg text-xs flex items-center justify-between" :class="form.webhook_enabled ? 'bg-indigo-50 border border-indigo-200 text-indigo-700' : 'bg-gray-100 border border-gray-200 text-gray-400'">
          <span class="font-mono truncate">
            <span v-if="!form.webhook_enabled" class="text-gray-400 mr-1">[OFF]</span>
            {{ form.webhook_method }} {{ form.webhook_url }} <span class="opacity-60">({{ form.webhook_delay }}ms delay)</span>
          </span>
          <button @click="clearWebhook" class="text-indigo-400 hover:text-red-500 ml-2 flex-shrink-0" title="Remove callback">
            <TrashIcon class="h-3.5 w-3.5" />
          </button>
        </div>
        <div v-if="showWebhook" class="p-3 border border-indigo-200 bg-indigo-50/50 rounded-lg space-y-3">
          <!-- Enabled toggle -->
          <div class="flex items-center justify-between">
            <label class="flex items-center space-x-2 cursor-pointer">
              <input type="checkbox" v-model="form.webhook_enabled" class="sr-only peer" />
              <div class="w-8 h-[18px] bg-gray-300 peer-checked:bg-indigo-500 rounded-full relative transition-colors">
                <div class="absolute top-[3px] left-[3px] w-3 h-3 bg-white rounded-full transition-transform peer-checked:translate-x-[14px]"></div>
              </div>
              <span class="text-xs font-medium" :class="form.webhook_enabled ? 'text-indigo-700' : 'text-gray-400'">
                {{ form.webhook_enabled ? 'Enabled' : 'Disabled' }}
              </span>
            </label>
            <button @click="clearWebhook" class="text-xs text-red-500 hover:text-red-700">Remove Callback</button>
          </div>
          <div class="grid grid-cols-12 gap-2">
            <div class="col-span-2">
              <label class="block text-xs font-medium text-gray-600 mb-1">Method</label>
              <select v-model="form.webhook_method" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
                <option v-for="m in ['POST','PUT','PATCH','DELETE','GET']" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <div class="col-span-7">
              <label class="block text-xs font-medium text-gray-600 mb-1">Callback URL <span class="text-gray-400 font-normal">(supports templates)</span></label>
              <input type="text" v-model="form.webhook_url" placeholder="https://your-app.com/webhooks/callback" class="w-full px-2 py-1.5 text-sm font-mono border border-gray-300 rounded-lg" />
            </div>
            <div class="col-span-3">
              <label class="block text-xs font-medium text-gray-600 mb-1">Delay (ms)</label>
              <input type="number" v-model.number="form.webhook_delay" min="0" max="300000" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Content-Type</label>
              <select v-model="form.webhook_content_type" class="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg">
                <option value="application/json">application/json</option>
                <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                <option value="text/plain">text/plain</option>
                <option value="text/html">text/html</option>
                <option value="application/xml">application/xml</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-600 mb-1">Custom Headers <span class="text-gray-400 font-normal">(JSON)</span></label>
              <input type="text" v-model="form.webhook_headers_raw" placeholder='{"X-Webhook-Secret":"abc123"}' class="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium text-gray-600">Callback Body <span class="text-gray-400 font-normal">(supports all template variables)</span></label>
              <div class="flex items-center space-x-2">
                <button @click="showWebhookTagPanel = !showWebhookTagPanel" class="text-xs flex items-center space-x-1" :class="showWebhookTagPanel ? 'text-rose-600' : 'text-rose-500 hover:text-rose-600'">
                  <CodeBracketIcon class="h-3 w-3" />
                  <span>Insert Tag</span>
                </button>
                <button @click="beautifyWebhookBody" class="text-xs text-blue-600 hover:text-blue-700">Beautify</button>
              </div>
            </div>
            <!-- Webhook Tag Reference Panel -->
            <div v-if="showWebhookTagPanel" class="mb-2 border border-rose-200 bg-rose-50 rounded-lg p-3 space-y-2.5">
              <div v-for="cat in tagCategories" :key="'wh-' + cat.label">
                <p class="text-xs font-semibold text-gray-600 mb-1">{{ cat.label }}</p>
                <div class="flex flex-wrap gap-1">
                  <button
                    v-for="tag in cat.tags" :key="'wh-' + tag.value"
                    @click="insertWebhookTag(tag.value)"
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
            <div class="border border-gray-300 rounded-lg overflow-hidden">
              <div
                v-if="!webhookBodyFocused"
                @click="focusWebhookBody"
                class="px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words overflow-auto bg-gray-50 cursor-text"
                style="max-height: 300px; min-height: 64px; word-break: break-word; tab-size: 2; line-height: 1.5;"
                v-html="webhookBodyHighlighted"
              ></div>
              <textarea
                v-else
                ref="webhookTextareaRef"
                v-model="form.webhook_body"
                @blur="onWebhookBodyBlur"
                class="w-full px-3 py-2 text-xs font-mono whitespace-pre-wrap break-words overflow-auto bg-gray-50 resize-none border-none outline-none"
                style="max-height: 300px; min-height: 64px; word-break: break-word; tab-size: 2; line-height: 1.5;"
                spellcheck="false"
                placeholder='{"event":"lead.created","data":{"id":"{{$uuid}}","email":"{{body.email}}"}}'
              ></textarea>
            </div>
          </div>
          <p class="text-xs text-gray-400">Fires asynchronously after the main response. In Docker, use <code class="text-indigo-500">host.docker.internal</code> instead of <code class="text-indigo-500">localhost</code>.</p>
        </div>
      </div>

      <!-- Save -->
      <div class="flex items-center justify-between">
        <span class="text-xs text-gray-400">Ctrl+S to save</span>
        <button @click="saveRule" :disabled="saving" class="px-4 py-2 text-sm rounded-lg transition flex items-center space-x-1.5" :class="dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 hover:bg-gray-300'">
          <svg v-if="saving" class="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          <CheckCircleIcon v-else-if="!dirty" class="h-3.5 w-3.5" />
          <span>{{ saving ? 'Saving...' : dirty ? 'Save Rule' : 'Saved' }}</span>
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
import { ref, reactive, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { TrashIcon, ChevronDownIcon, ClipboardDocumentIcon, CodeBracketIcon, CheckCircleIcon, ExclamationCircleIcon, DocumentDuplicateIcon } from '@heroicons/vue/24/outline'
import ConditionBuilder from './ConditionBuilder.vue'
import Swal from 'sweetalert2'

const props = defineProps({ rule: Object })
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const expanded = ref(false)
const saving = ref(false)
const showBulkConditions = ref(false)
const bulkConditionsText = ref('')
const textareaRef = ref(null)
const showTagPanel = ref(false)
const showWebhookTagPanel = ref(false)
const webhookTextareaRef = ref(null)
const bodyFocused = ref(false)
const webhookBodyFocused = ref(false)
let lastBodyCursor = -1
let lastWebhookBodyCursor = -1
const tooltip = reactive({ visible: false, x: 0, y: 0, desc: '', example: '' })
const dirty = ref(false)
const saved = ref(true)
let ignoreDirty = false

// Ctrl+S handler
function handleKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    if (expanded.value) {
      e.preventDefault()
      if (dirty.value && !saving.value) {
        saveRule()
      }
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

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
    label: 'First Log — {{logs.*}} (oldest match when exists_in_logs)',
    tags: [
      { label: '{{logs.requestBody.*}}', value: '{{logs.requestBody.}}', desc: 'Request body from the FIRST matching log', example: '{{logs.requestBody.email}} → first request email', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.responseBody.*}}', value: '{{logs.responseBody.}}', desc: 'Response body from the FIRST match (parsed JSON)', example: '{{logs.responseBody.data.id}} → original ID', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.responseStatus}}', value: '{{logs.responseStatus}}', desc: 'HTTP status from the FIRST match', example: '→ 200', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.timestamp}}', value: '{{logs.timestamp}}', desc: 'When the FIRST matching request arrived', example: '→ 2026-02-25 19:02:39', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
      { label: '{{logs.headers.*}}', value: '{{logs.headers.}}', desc: 'Header from the FIRST matching log', example: '{{logs.headers.user-agent}}', color: 'bg-white border-cyan-300 text-cyan-700 hover:bg-cyan-50' },
    ]
  },
  {
    label: 'Last Log — {{lastlog.*}} (newest match when exists_in_logs)',
    tags: [
      { label: '{{lastlog.requestBody.*}}', value: '{{lastlog.requestBody.}}', desc: 'Request body from the MOST RECENT matching log', example: '{{lastlog.requestBody.email}} → latest request email', color: 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50' },
      { label: '{{lastlog.responseBody.*}}', value: '{{lastlog.responseBody.}}', desc: 'Response body from the MOST RECENT match (parsed JSON)', example: '{{lastlog.responseBody.data.id}} → latest ID', color: 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50' },
      { label: '{{lastlog.responseStatus}}', value: '{{lastlog.responseStatus}}', desc: 'HTTP status from the MOST RECENT match', example: '→ 200', color: 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50' },
      { label: '{{lastlog.timestamp}}', value: '{{lastlog.timestamp}}', desc: 'When the MOST RECENT matching request arrived', example: '→ 2026-02-25 20:15:00', color: 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50' },
      { label: '{{lastlog.headers.*}}', value: '{{lastlog.headers.}}', desc: 'Header from the MOST RECENT matching log', example: '{{lastlog.headers.user-agent}}', color: 'bg-white border-orange-300 text-orange-700 hover:bg-orange-50' },
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
  bodyFocused.value = true
  nextTick(() => {
    const ta = textareaRef.value
    if (!ta) {
      form.body = (form.body || '') + tag
      return
    }
    ta.focus()
    // Restore cursor position saved on blur
    if (lastBodyCursor >= 0) {
      ta.setSelectionRange(lastBodyCursor, lastBodyCursor)
      lastBodyCursor = -1
    }
    document.execCommand('insertText', false, tag)
    if (tag.endsWith('.}}')) {
      nextTick(() => {
        const pos = ta.selectionStart - 2
        ta.setSelectionRange(pos, pos)
      })
    }
  })
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

function onBodyBlur() {
  const ta = textareaRef.value
  if (ta) lastBodyCursor = ta.selectionStart
  bodyFocused.value = false
}

function focusBody() {
  bodyFocused.value = true
  nextTick(() => { textareaRef.value?.focus() })
}

const webhookBodyHighlighted = computed(() => {
  const raw = form.webhook_body || ''
  if (!raw.trim()) return '<span class="text-gray-400 italic">Empty callback body</span>'
  const escaped = escapeHtml(raw)
  const trimmed = raw.trim()
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return highlightJson(escaped)
  if (trimmed.startsWith('<')) return highlightXml(escaped)
  return escaped.replace(/\{\{([^}]+)\}\}/g, (m, expr) => `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`)
})

function onWebhookBodyBlur() {
  const ta = webhookTextareaRef.value
  if (ta) lastWebhookBodyCursor = ta.selectionStart
  webhookBodyFocused.value = false
}

function focusWebhookBody() {
  webhookBodyFocused.value = true
  nextTick(() => { webhookTextareaRef.value?.focus() })
}

function insertWebhookTag(tag) {
  webhookBodyFocused.value = true
  nextTick(() => {
    const ta = webhookTextareaRef.value
    if (!ta) {
      form.webhook_body = (form.webhook_body || '') + tag
      return
    }
    ta.focus()
    // Restore cursor position saved on blur
    if (lastWebhookBodyCursor >= 0) {
      ta.setSelectionRange(lastWebhookBodyCursor, lastWebhookBodyCursor)
      lastWebhookBodyCursor = -1
    }
    document.execCommand('insertText', false, tag)
    if (tag.endsWith('.}}')) {
      nextTick(() => {
        const pos = ta.selectionStart - 2
        ta.setSelectionRange(pos, pos)
      })
    }
  })
}

function beautifyWebhookBody() {
  const text = (form.webhook_body || '').trim()
  if (!text) return

  // Try JSON (with template support)
  const result = beautifyWithTemplates(text)
  if (result !== null) {
    form.webhook_body = result
    notificationStore.showToast('JSON formatted', 'success')
    return
  }

  if (text.startsWith('<')) {
    let formatted = ''
    let indent = 0
    const tags = text.replace(/>\s*</g, '><').split(/(<[^>]+>)/).filter(Boolean)
    for (const tag of tags) {
      if (tag.match(/^<\/\w/)) indent--
      formatted += '  '.repeat(Math.max(0, indent)) + tag.trim() + '\n'
      if (tag.match(/^<\w[^/]*[^/]>$/)) indent++
    }
    form.webhook_body = formatted.trim()
    notificationStore.showToast('XML formatted', 'success')
    return
  }
  notificationStore.showToast('Could not detect format', 'info')
}

const showWebhook = ref(false)

const form = reactive({
  name: props.rule.name || '',
  priority: props.rule.priority,
  status_code: props.rule.statusCode,
  content_type: props.rule.contentType,
  body: props.rule.body,
  delay: props.rule.delay,
  conditions: [...(props.rule.conditions || [])],
  webhook_url: props.rule.webhookUrl || '',
  webhook_method: props.rule.webhookMethod || 'POST',
  webhook_headers_raw: JSON.stringify(props.rule.webhookHeaders || {}),
  webhook_body: props.rule.webhookBody || '',
  webhook_delay: props.rule.webhookDelay || 0,
  webhook_content_type: props.rule.webhookContentType || 'application/json',
  webhook_enabled: props.rule.webhookEnabled !== undefined ? props.rule.webhookEnabled : true
})

watch(() => props.rule, (r) => {
  ignoreDirty = true
  form.name = r.name || ''
  form.priority = r.priority
  form.status_code = r.statusCode
  form.content_type = r.contentType
  form.body = r.body
  form.delay = r.delay
  form.conditions = [...(r.conditions || [])]
  form.webhook_url = r.webhookUrl || ''
  form.webhook_method = r.webhookMethod || 'POST'
  form.webhook_headers_raw = JSON.stringify(r.webhookHeaders || {})
  form.webhook_body = r.webhookBody || ''
  form.webhook_delay = r.webhookDelay || 0
  form.webhook_content_type = r.webhookContentType || 'application/json'
  form.webhook_enabled = r.webhookEnabled !== undefined ? r.webhookEnabled : true
  dirty.value = false
  saved.value = true
  nextTick(() => { ignoreDirty = false })
}, { deep: true })

// Track changes to mark as dirty (must be after form declaration)
watch(form, () => {
  if (ignoreDirty) return
  dirty.value = true
  saved.value = false
}, { deep: true })

function markDirty() {
  nextTick(() => {
    dirty.value = true
    saved.value = false
  })
}

function addCondition() {
  form.conditions.push({ field: '', operator: 'equals', value: '' })
  markDirty()
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

function copyBody() {
  navigator.clipboard.writeText(form.body || '')
    .then(() => notificationStore.showToast('Response body copied', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
}

// Replace {{...}} template tags with quoted placeholders so JSON.parse works,
// then restore them after formatting.
function beautifyWithTemplates(text) {
  const templates = []
  const safe = text.replace(/\{\{[^}]+\}\}/g, (match) => {
    const idx = templates.length
    templates.push(match)
    return `"__TPL_${idx}__"`
  })
  try {
    const parsed = JSON.parse(safe)
    let formatted = JSON.stringify(parsed, null, 2)
    // Restore template tags — remove the quotes we added around placeholders
    templates.forEach((tpl, i) => {
      formatted = formatted.replace(`"__TPL_${i}__"`, tpl)
    })
    return formatted
  } catch (e) {
    return null
  }
}

function beautifyBody() {
  const text = form.body.trim()
  if (!text) return

  // Try JSON (with template support)
  const result = beautifyWithTemplates(text)
  if (result !== null) {
    form.body = result
    notificationStore.showToast('JSON formatted', 'success')
    return
  }

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

function clearWebhook() {
  form.webhook_url = ''
  form.webhook_method = 'POST'
  form.webhook_headers_raw = '{}'
  form.webhook_body = ''
  form.webhook_delay = 0
  form.webhook_content_type = 'application/json'
  form.webhook_enabled = true
  showWebhook.value = false
}

async function saveRule() {
  try {
    saving.value = true
    // Parse webhook headers from raw JSON string
    let webhookHeaders = {}
    try { webhookHeaders = JSON.parse(form.webhook_headers_raw || '{}') } catch (_) {}
    const payload = {
      ...form,
      webhook_headers: webhookHeaders
    }
    delete payload.webhook_headers_raw
    await mockStore.updateRule(props.rule.id, payload)
    dirty.value = false
    saved.value = true
    notificationStore.showToast('Rule saved', 'success')
  } catch (error) {
    notificationStore.showToast('Failed to save rule', 'error')
  } finally {
    saving.value = false
  }
}

async function duplicateRule() {
  const existingNames = (mockStore.activeRoute?.rules || []).map(r => (r.name || '').toLowerCase()).filter(Boolean)

  const { value: newName } = await Swal.fire({
    title: 'Duplicate rule',
    input: 'text',
    inputLabel: 'Name for the new rule',
    inputValue: props.rule.name ? `${props.rule.name} (copy)` : '',
    inputPlaceholder: 'Rule name...',
    showCancelButton: true,
    confirmButtonText: 'Duplicate',
    inputValidator: (val) => {
      if (!val || !val.trim()) return 'Please enter a name'
      if (existingNames.includes(val.trim().toLowerCase())) return 'A rule with this name already exists'
    }
  })

  if (!newName) return

  try {
    await mockStore.createRule(props.rule.routeId, {
      name: newName.trim(),
      priority: props.rule.priority + 1,
      conditions: props.rule.conditions || [],
      status_code: props.rule.statusCode,
      content_type: props.rule.contentType,
      body: props.rule.body,
      delay: props.rule.delay,
      webhook_url: props.rule.webhookUrl || null,
      webhook_method: props.rule.webhookMethod || 'POST',
      webhook_headers: props.rule.webhookHeaders || {},
      webhook_body: props.rule.webhookBody || null,
      webhook_delay: props.rule.webhookDelay || 0,
      webhook_content_type: props.rule.webhookContentType || 'application/json',
      webhook_enabled: props.rule.webhookEnabled !== undefined ? props.rule.webhookEnabled : true
    })
    notificationStore.showToast(`Rule duplicated: ${newName.trim()}`, 'success')
  } catch (e) {
    notificationStore.showToast('Failed to duplicate rule', 'error')
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
