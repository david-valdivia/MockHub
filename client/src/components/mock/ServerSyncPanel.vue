<template>
  <div class="border-t border-gray-200 bg-gray-50">
    <!-- Server selector header -->
    <div class="px-4 py-2 border-b border-gray-100">
      <div class="flex items-center justify-between">
        <h3 class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Servers</h3>
        <button @click="showAddModal = true" class="p-1 text-gray-400 hover:text-blue-600 rounded" title="Add server">
          <PlusIcon class="h-3.5 w-3.5" />
        </button>
      </div>
    </div>

    <div class="py-1">
      <!-- Local server (always first, always present) -->
      <div class="mx-2 mb-0.5">
        <div
          class="flex items-center px-3 py-2 rounded-lg cursor-pointer group text-sm"
          :class="isLocalActive ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'"
          @click="selectLocal"
        >
          <span
            class="h-2.5 w-2.5 rounded-full border-2 mr-2 flex-shrink-0 transition-colors"
            :class="isLocalActive ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'"
          ></span>
          <ComputerDesktopIcon class="h-4 w-4 mr-2 flex-shrink-0" :class="isLocalActive ? 'text-blue-500' : 'text-gray-400'" />
          <span class="text-xs font-medium truncate flex-1">Local</span>
        </div>

        <div v-if="isLocalActive" class="ml-7 mr-2 mb-2">
          <p class="text-[10px] text-gray-400 leading-relaxed px-1 py-1.5">
            Data stored in local database. Lost if database is deleted. Use <strong class="text-gray-500">Copy To...</strong> to back up to a server.
          </p>
        </div>
      </div>

      <!-- Remote servers -->
      <div
        v-for="server in mockStore.servers"
        :key="server.id"
        class="mx-2 mb-0.5"
      >
        <!-- Server row -->
        <div
          class="flex items-center px-3 py-2 rounded-lg cursor-pointer group text-sm"
          :class="isServerActive(server.id) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-100 text-gray-700'"
          @click="selectServer(server)"
        >
          <span
            class="h-2.5 w-2.5 rounded-full border-2 mr-2 flex-shrink-0 transition-colors"
            :class="isServerActive(server.id) ? 'border-blue-500 bg-blue-500' : 'border-gray-300 bg-white'"
          ></span>
          <CloudIcon class="h-4 w-4 mr-2 flex-shrink-0" :class="isServerActive(server.id) ? 'text-blue-500' : 'text-gray-400'" />
          <span class="text-xs font-medium truncate flex-1">{{ server.name }}</span>
          <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button @click.stop="editServer(server)" class="p-0.5 hover:bg-gray-200 rounded" title="Edit">
              <PencilSquareIcon class="h-3 w-3" />
            </button>
            <button @click.stop="confirmDeleteServer(server)" class="p-0.5 hover:bg-red-100 hover:text-red-600 rounded" title="Delete">
              <TrashIcon class="h-3 w-3" />
            </button>
          </div>
        </div>

        <!-- Expanded server panel -->
        <div v-if="isServerActive(server.id)" class="ml-7 mr-2 mb-2">
          <!-- Last sync -->
          <p v-if="server.lastSync" class="text-[10px] text-gray-400 mb-1 px-1">
            Last sync: {{ new Date(server.lastSync).toLocaleString() }}
          </p>

          <!-- Action buttons -->
          <div class="flex space-x-2 mb-1">
            <button
              @click="loadRemoteEnvs(server)"
              :disabled="loadingRemote"
              class="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center justify-center space-x-1"
            >
              <ArrowDownTrayIcon class="h-3 w-3" />
              <span>{{ loadingRemote ? 'Loading...' : 'Pull from GitHub' }}</span>
            </button>
            <button
              @click="showPushPanel = !showPushPanel"
              class="flex-1 px-2 py-1.5 text-xs bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center space-x-1"
            >
              <ArrowUpTrayIcon class="h-3 w-3" />
              <span>Push to GitHub</span>
            </button>
          </div>

          <!-- Remote environments (Pull from GitHub) -->
          <div v-if="remoteEnvs.length > 0" class="bg-white border border-gray-200 rounded-lg mb-2">
            <p class="px-2 py-1.5 text-[10px] text-gray-500 font-semibold uppercase border-b border-gray-100">GitHub Environments</p>
            <div
              v-for="env in remoteEnvs"
              :key="env.slug"
              class="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 text-xs"
            >
              <div class="truncate flex-1">
                <span class="font-medium text-gray-800">{{ env.name }}</span>
                <span class="text-gray-400 ml-1">{{ env.basePath }}</span>
              </div>
              <button
                @click="doPull(server, env)"
                :disabled="pulling === env.slug"
                class="ml-2 px-2 py-0.5 text-[10px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex-shrink-0"
              >
                {{ pulling === env.slug ? 'Pulling...' : 'Pull' }}
              </button>
            </div>
          </div>

          <!-- Push panel -->
          <div v-if="showPushPanel" class="bg-white border border-gray-200 rounded-lg">
            <p class="px-2 py-1.5 text-[10px] text-gray-500 font-semibold uppercase border-b border-gray-100">Push to GitHub</p>
            <div
              v-for="env in mockStore.environments"
              :key="env.id"
              class="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 text-xs"
            >
              <div class="truncate flex-1">
                <span class="font-medium text-gray-800">{{ env.name }}</span>
                <span class="text-gray-400 ml-1">{{ env.basePath }}</span>
              </div>
              <button
                @click="doPush(server, env)"
                :disabled="pushing === env.id"
                class="ml-2 px-2 py-0.5 text-[10px] bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
              >
                {{ pushing === env.id ? 'Pushing...' : 'Push' }}
              </button>
            </div>
            <div v-if="mockStore.environments.length === 0" class="px-2 py-2 text-xs text-gray-400 text-center">
              No environments in this server
            </div>
          </div>
        </div>
      </div>
    </div>

    <ServerModal v-if="showAddModal" @close="showAddModal = false" />
    <ServerModal v-if="showEditModal" :edit-server="editingServer" @close="showEditModal = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  PlusIcon, CloudIcon, ComputerDesktopIcon, PencilSquareIcon, TrashIcon,
  ArrowDownTrayIcon, ArrowUpTrayIcon
} from '@heroicons/vue/24/outline'
import ServerModal from './ServerModal.vue'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()

const showAddModal = ref(false)
const showEditModal = ref(false)
const editingServer = ref(null)
const remoteEnvs = ref([])
const loadingRemote = ref(false)
const pulling = ref(null)
const pushing = ref(null)
const showPushPanel = ref(false)

const isLocalActive = computed(() => !mockStore.activeSyncServerId)
function isServerActive(serverId) {
  return mockStore.activeSyncServerId === serverId
}

function selectLocal() {
  mockStore.selectLocalServer()
  remoteEnvs.value = []
  showPushPanel.value = false
}

function selectServer(server) {
  if (mockStore.activeSyncServerId === server.id) return
  remoteEnvs.value = []
  showPushPanel.value = false
  mockStore.selectRemoteServer(server.id)
}

function editServer(server) {
  editingServer.value = server
  showEditModal.value = true
}

function confirmDeleteServer(server) {
  Swal.fire({
    title: 'Delete server?',
    text: `Remove "${server.name}" from your servers?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Delete',
    preConfirm: async () => {
      await mockStore.deleteServer(server.id)
    }
  })
}

async function loadRemoteEnvs(server) {
  try {
    loadingRemote.value = true
    remoteEnvs.value = await mockStore.getServerEnvironments(server.id)
    if (remoteEnvs.value.length === 0) {
      notificationStore.showToast('No environments found in repo', 'info')
    }
  } catch (error) {
    notificationStore.showToast(error.message || 'Failed to load remote environments', 'error')
  } finally {
    loadingRemote.value = false
  }
}

async function doPull(server, env) {
  try {
    pulling.value = env.slug
    await mockStore.pullFromServer(server.id, env.slug)
    notificationStore.showToast(`Pulled "${env.name}" successfully`, 'success')
  } catch (error) {
    notificationStore.showToast(error.message || 'Pull failed', 'error')
  } finally {
    pulling.value = null
  }
}

async function doPush(server, env) {
  const { isConfirmed } = await Swal.fire({
    title: 'Push to ' + server.name + '?',
    text: `Push "${env.name}" to ${server.name}? This will create/update files in the repo.`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Push'
  })
  if (!isConfirmed) return

  try {
    pushing.value = env.id
    await mockStore.pushToServer(server.id, env.id)
    notificationStore.showToast(`Pushed "${env.name}" successfully`, 'success')
  } catch (error) {
    notificationStore.showToast(error.message || 'Push failed', 'error')
  } finally {
    pushing.value = null
  }
}
</script>
