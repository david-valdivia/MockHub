<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click.self="$emit('close')">
    <div class="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">{{ editServer ? 'Edit Server' : 'Add GitHub Server' }}</h2>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Server Name</label>
          <input v-model="form.name" required class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="e.g. My Org Mocks" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Repository URL</label>
          <input v-model="form.repo_url" required class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" placeholder="https://github.com/org/repo" />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Personal Access Token</label>
          <input v-model="form.token" :required="!editServer" type="password" class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" placeholder="ghp_xxxxxxxxxxxx" />
          <p v-if="editServer" class="text-xs text-gray-400 mt-1">Leave blank to keep existing token</p>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Branch</label>
          <input v-model="form.branch" class="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" placeholder="main" />
        </div>

        <!-- Token permissions info -->
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <p class="font-semibold mb-1">Required Token Permissions:</p>
          <p><strong>Classic token:</strong> <code class="bg-blue-100 px-1 rounded">repo</code> scope</p>
          <p><strong>Fine-grained:</strong> Contents (Read and write) on the target repo</p>
        </div>

        <!-- Test connection result -->
        <div v-if="testResult" class="rounded-lg p-3 text-xs" :class="testResult.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'">
          <p v-if="testResult.success">
            Connected to <strong>{{ testResult.repoName }}</strong>
            <span v-if="testResult.private" class="ml-1 text-gray-500">(private)</span>
            <br />Push access: {{ testResult.canPush ? 'Yes' : 'No (read-only)' }}
          </p>
          <p v-else>{{ testResult.error }}</p>
        </div>

        <div class="flex justify-between pt-2">
          <button
            v-if="editServer"
            type="button"
            @click="testConn"
            :disabled="testing"
            class="px-4 py-2 text-sm border border-blue-300 text-blue-700 rounded-lg hover:bg-blue-50 disabled:opacity-50"
          >
            {{ testing ? 'Testing...' : 'Test Connection' }}
          </button>
          <div v-else></div>
          <div class="flex space-x-3">
            <button type="button" @click="$emit('close')" class="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" :disabled="saving" class="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {{ saving ? 'Saving...' : (editServer ? 'Save' : 'Add Server') }}
            </button>
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'

const props = defineProps({
  editServer: { type: Object, default: null }
})
const emit = defineEmits(['close'])
const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const saving = ref(false)
const testing = ref(false)
const testResult = ref(null)

const form = reactive({
  name: props.editServer?.name || '',
  repo_url: props.editServer?.repoUrl || '',
  token: '',
  branch: props.editServer?.branch || 'main'
})

async function submit() {
  try {
    saving.value = true
    if (props.editServer) {
      const data = { name: form.name, repo_url: form.repo_url, branch: form.branch }
      if (form.token) data.token = form.token
      await mockStore.updateServer(props.editServer.id, data)
      notificationStore.showToast('Server updated', 'success')
    } else {
      await mockStore.createServer(form)
      notificationStore.showToast('Server added', 'success')
    }
    emit('close')
  } catch (error) {
    notificationStore.showToast(error.message || 'Failed to save server', 'error')
  } finally {
    saving.value = false
  }
}

async function testConn() {
  try {
    testing.value = true
    testResult.value = null
    const result = await mockStore.testServerConnection(props.editServer.id)
    testResult.value = result
  } catch (error) {
    testResult.value = { success: false, error: error.message || 'Connection failed' }
  } finally {
    testing.value = false
  }
}
</script>
