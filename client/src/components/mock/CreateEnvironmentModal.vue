<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Create Environment</h2>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input v-model="form.name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. Stripe Mock" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Base Path</label>
          <input v-model="form.base_path" required class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono" placeholder="e.g. /stripe" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Slug</label>
          <input v-model="form.slug" class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" :placeholder="autoSlug" />
          <p class="text-xs text-gray-400 mt-1">URL-safe name for GitHub sync. Auto-generated from name if empty.</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea v-model="form.description" rows="2" class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Optional description"></textarea>
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
import { ref, reactive, computed } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'

const emit = defineEmits(['close'])
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const saving = ref(false)
const form = reactive({ name: '', base_path: '', description: '', slug: '' })

const autoSlug = computed(() => {
  return form.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'my-environment'
})

async function submit() {
  try {
    saving.value = true
    await mockStore.createEnvironment(form)
    notificationStore.showToast('Environment created', 'success')
    emit('close')
  } catch (error) {
    notificationStore.showToast('Failed to create environment', 'error')
  } finally {
    saving.value = false
  }
}
</script>
