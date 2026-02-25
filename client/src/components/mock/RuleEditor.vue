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
          <label class="block text-xs font-medium text-gray-600 mb-1">Priority</label>
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
          <button @click="addCondition" class="text-xs text-blue-600 hover:text-blue-700">+ Add Condition</button>
        </div>
        <ConditionBuilder v-model="form.conditions" />
      </div>

      <!-- Body -->
      <div>
        <label class="block text-xs font-medium text-gray-600 mb-1">Response Body <span class="text-gray-400">(supports &#123;&#123;params.id&#125;&#125;, &#123;&#123;$uuid&#125;&#125;, etc.)</span></label>
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
import { TrashIcon, ChevronDownIcon } from '@heroicons/vue/24/outline'
import ConditionBuilder from './ConditionBuilder.vue'
import Swal from 'sweetalert2'

const props = defineProps({ rule: Object })
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const expanded = ref(false)
const saving = ref(false)

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
