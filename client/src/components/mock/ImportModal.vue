<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">Import Environment</h2>
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Select MockHub JSON file</label>
          <input type="file" accept=".json" @change="onFileChange" class="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
        </div>
        <div v-if="preview" class="bg-gray-50 rounded-lg p-4">
          <p class="text-sm font-medium text-gray-700">{{ preview.environment?.name }}</p>
          <p class="text-xs text-gray-500 font-mono">{{ preview.environment?.base_path }}</p>
          <p class="text-xs text-gray-400 mt-1">{{ preview.environment?.groups?.length || 0 }} groups, {{ routeCount }} routes</p>
        </div>
        <div v-if="error" class="text-sm text-red-600">{{ error }}</div>
        <div class="flex justify-end space-x-3 pt-2">
          <button @click="$emit('close')" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
          <button @click="doImport" :disabled="!preview || importing" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            {{ importing ? 'Importing...' : 'Import' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'

const emit = defineEmits(['close'])
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const preview = ref(null)
const error = ref('')
const importing = ref(false)

const routeCount = computed(() => {
  if (!preview.value?.environment?.groups) return 0
  return preview.value.environment.groups.reduce((sum, g) => sum + (g.routes?.length || 0), 0)
})

function onFileChange(event) {
  const file = event.target.files[0]
  if (!file) return
  error.value = ''
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result)
      if (!data.mockhub_version || !data.environment) {
        error.value = 'Invalid MockHub export file'
        preview.value = null
        return
      }
      preview.value = data
    } catch (err) {
      error.value = 'Invalid JSON file'
      preview.value = null
    }
  }
  reader.readAsText(file)
}

async function doImport() {
  try {
    importing.value = true
    await mockStore.importEnvironment(preview.value)
    notificationStore.showToast('Environment imported', 'success')
    emit('close')
  } catch (err) {
    notificationStore.showToast('Failed to import', 'error')
  } finally {
    importing.value = false
  }
}
</script>
