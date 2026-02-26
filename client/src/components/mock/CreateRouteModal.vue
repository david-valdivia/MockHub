<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Create Route</h2>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">HTTP Method</label>
          <select v-model="method" class="w-full px-3 py-2 border border-gray-300 rounded-lg">
            <option>GET</option><option>POST</option><option>PUT</option>
            <option>PATCH</option><option>DELETE</option><option>ALL</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Path</label>
          <input v-model="pathPattern" class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono" placeholder="e.g. /charges/:id" />
          <p class="text-xs text-gray-400 mt-1">Optional. Supports <code>:param</code> variables.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input v-model="slug" class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" :placeholder="autoSlug" />
          <p class="text-xs text-gray-400 mt-1">Auto-generated from path if empty.</p>
        </div>
        <div class="flex justify-end space-x-3 pt-2">
          <button type="button" @click="$emit('close')" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button type="submit" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ saving ? 'Creating...' : 'Create' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'

const props = defineProps({ groupId: Number })
const emit = defineEmits(['close'])
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const method = ref('GET')
const pathPattern = ref('')
const slug = ref('')
const saving = ref(false)

const autoSlug = computed(() => {
  return pathPattern.value.toLowerCase().replace(/^\/+/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-route'
})

async function submit() {
  try {
    saving.value = true
    const data = { method: method.value, path_pattern: pathPattern.value }
    if (slug.value) data.slug = slug.value
    await mockStore.createRoute(props.groupId, data)
    notificationStore.showToast('Route created', 'success')
    emit('close')
  } catch (error) {
    notificationStore.showToast('Failed to create route', 'error')
  } finally {
    saving.value = false
  }
}
</script>
