<template>
  <div class="space-y-2">
    <div v-for="(condition, index) in modelValue" :key="index">
      <!-- AND/OR toggle between conditions -->
      <div v-if="index > 0" class="flex items-center justify-center py-1">
        <div class="flex-1 border-t border-gray-200"></div>
        <button
          @click="toggleLogic(index)"
          class="mx-3 px-3 py-0.5 text-[10px] font-bold rounded-full border transition"
          :class="condition.logic === 'or'
            ? 'bg-orange-100 border-orange-300 text-orange-700 hover:bg-orange-200'
            : 'bg-blue-100 border-blue-300 text-blue-700 hover:bg-blue-200'"
        >
          {{ (condition.logic || 'and').toUpperCase() }}
        </button>
        <div class="flex-1 border-t border-gray-200"></div>
      </div>
      <div class="flex items-center space-x-2">
        <div class="relative flex-1">
          <input
            :ref="el => fieldRefs[index] = el"
            v-model="condition.field"
            placeholder="e.g. headers.authorization"
            class="w-full px-2 py-1.5 text-xs border border-gray-300 rounded"
            @focus="activeFieldIndex = index"
            @blur="onFieldBlur"
            @input="emitChange"
          />
          <!-- Field suggestions dropdown -->
          <div
            v-if="activeFieldIndex === index && fieldSuggestions(condition.field).length > 0"
            class="absolute z-50 top-full left-0 mt-0.5 w-full bg-white border border-gray-200 rounded shadow-lg max-h-40 overflow-y-auto"
          >
            <button
              v-for="sug in fieldSuggestions(condition.field)" :key="sug.value"
              @mousedown.prevent="insertField(index, sug.value)"
              class="w-full px-2 py-1 text-left text-xs hover:bg-blue-50 flex items-center justify-between"
            >
              <span class="font-mono" :class="sug.color">{{ sug.value }}</span>
              <span class="text-gray-400 ml-2 truncate">{{ sug.desc }}</span>
            </button>
          </div>
        </div>
        <select v-model="condition.operator" @change="emitChange" class="w-40 px-2 py-1.5 text-xs border border-gray-300 rounded flex-shrink-0">
          <option value="equals">equals</option>
          <option value="not_equals">not equals</option>
          <option value="contains">contains</option>
          <option value="not_contains">not contains</option>
          <option value="exists">exists</option>
          <option value="not_exists">not exists</option>
          <option value="gt">&gt;</option>
          <option value="gte">&gt;=</option>
          <option value="lt">&lt;</option>
          <option value="lte">&lt;=</option>
          <option value="matches">regex</option>
          <option value="exists_in_logs">exists in logs</option>
          <option value="not_exists_in_logs">not in logs</option>
        </select>
        <input
          v-if="!['exists', 'not_exists', 'exists_in_logs', 'not_exists_in_logs'].includes(condition.operator)"
          v-model="condition.value" placeholder="value"
          class="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded"
          @input="emitChange"
        />
        <button @click="removeCondition(index)" class="p-1 text-gray-400 hover:text-red-600">
          <XMarkIcon class="h-4 w-4" />
        </button>
      </div>
    </div>

    <!-- Quick insert tags -->
    <div class="flex flex-wrap gap-1 pt-1">
      <span class="text-xs text-gray-400 mr-1">Fields:</span>
      <button
        v-for="tag in fieldTags" :key="tag.value"
        @click="insertTagToLast(tag.value)"
        @mouseenter="showTooltip($event, tag)"
        @mouseleave="hideTooltip"
        class="px-1.5 py-0.5 text-[10px] font-mono rounded border transition"
        :class="tag.color"
      >
        {{ tag.label }}
      </button>
    </div>

    <p v-if="modelValue.length === 0" class="text-xs text-gray-400 italic">No conditions — this rule always matches (default)</p>

    <!-- Tooltip -->
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
import { ref, reactive } from 'vue'
import { XMarkIcon } from '@heroicons/vue/24/outline'

const props = defineProps({ modelValue: { type: Array, default: () => [] } })
const emit = defineEmits(['update:modelValue', 'change'])

const activeFieldIndex = ref(null)
const fieldRefs = ref({})
const tooltip = reactive({ visible: false, x: 0, y: 0, desc: '', example: '' })

const allFields = [
  { value: 'body.', desc: 'Request body field', example: 'body.email, body.user.name', color: 'text-green-700' },
  { value: 'params.', desc: 'URL path parameter', example: 'params.id, params.slug', color: 'text-green-700' },
  { value: 'query.', desc: 'Query string parameter', example: 'query.page, query.search', color: 'text-green-700' },
  { value: 'headers.', desc: 'Request header (case-insensitive)', example: 'headers.authorization, headers.x-api-key', color: 'text-blue-700' },
  { value: 'headers.authorization', desc: 'Authorization header', example: 'Bearer token...', color: 'text-blue-700' },
  { value: 'headers.content-type', desc: 'Content-Type header', example: 'application/json', color: 'text-blue-700' },
  { value: 'headers.x-api-key', desc: 'API Key header', example: 'my-secret-key', color: 'text-blue-700' },
  { value: 'method', desc: 'HTTP method', example: 'GET, POST, PUT...', color: 'text-purple-700' },
]

const fieldTags = [
  { label: 'body.*', value: 'body.', desc: 'Request body field (dot-notation)', example: 'body.email → user@test.com', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
  { label: 'params.*', value: 'params.', desc: 'URL path parameter from :param', example: '/users/:id → params.id', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
  { label: 'query.*', value: 'query.', desc: 'Query string parameter', example: '?page=3 → query.page', color: 'bg-white border-green-300 text-green-700 hover:bg-green-50' },
  { label: 'headers.*', value: 'headers.', desc: 'Request header (case-insensitive)', example: 'headers.authorization', color: 'bg-white border-blue-300 text-blue-700 hover:bg-blue-50' },
  { label: 'method', value: 'method', desc: 'HTTP method of the request', example: 'GET, POST, PUT, DELETE', color: 'bg-white border-purple-300 text-purple-700 hover:bg-purple-50' },
]

function fieldSuggestions(current) {
  if (!current && activeFieldIndex.value !== null) return allFields.slice(0, 5)
  if (!current) return []
  const lower = current.toLowerCase()
  return allFields.filter(f => f.value.toLowerCase().startsWith(lower) && f.value !== current).slice(0, 6)
}

function emitChange() {
  emit('update:modelValue', [...props.modelValue])
  emit('change')
}

function toggleLogic(index) {
  const condition = props.modelValue[index]
  condition.logic = (condition.logic || 'and') === 'and' ? 'or' : 'and'
  emitChange()
}

function insertField(index, value) {
  props.modelValue[index].field = value
  activeFieldIndex.value = null
  emitChange()
  const input = fieldRefs.value[index]
  if (input) {
    input.focus()
    setTimeout(() => {
      input.selectionStart = input.selectionEnd = value.length
    }, 0)
  }
}

function insertTagToLast(value) {
  if (props.modelValue.length === 0) return
  const last = props.modelValue[props.modelValue.length - 1]
  last.field = value
  emitChange()
}

function onFieldBlur() {
  setTimeout(() => { activeFieldIndex.value = null }, 150)
}

function removeCondition(index) {
  const updated = [...props.modelValue]
  updated.splice(index, 1)
  emit('update:modelValue', updated)
  emit('change')
}

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
</script>
