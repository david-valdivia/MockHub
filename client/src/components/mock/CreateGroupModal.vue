<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-sm p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Create Group</h2>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input v-model="name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="e.g. Charges" />
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
import { ref } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'

const props = defineProps({ environmentId: Number })
const emit = defineEmits(['close'])
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const name = ref('')
const saving = ref(false)

async function submit() {
  try {
    saving.value = true
    await mockStore.createGroup(props.environmentId, { name: name.value })
    notificationStore.showToast('Group created', 'success')
    emit('close')
  } catch (error) {
    notificationStore.showToast('Failed to create group', 'error')
  } finally {
    saving.value = false
  }
}
</script>
