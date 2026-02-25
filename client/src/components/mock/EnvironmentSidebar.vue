<template>
  <div class="w-72 bg-white border-r border-gray-200 h-screen flex flex-col overflow-hidden">
    <div class="flex-shrink-0 px-4 py-3 border-b border-gray-100">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wider">Environments</h2>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      <div v-if="mockStore.loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>

      <div v-else-if="mockStore.environments.length === 0" class="text-center py-8 px-4">
        <p class="text-gray-400 text-sm">No environments yet</p>
      </div>

      <div v-else>
        <div v-for="env in mockStore.environments" :key="env.id" class="mb-1">
          <!-- Environment Header -->
          <div
            class="flex items-center px-3 py-2 mx-2 rounded-lg cursor-pointer group"
            :class="mockStore.activeEnvironmentId === env.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'"
            @click="toggleEnvironment(env)"
          >
            <ChevronRightIcon
              class="h-3.5 w-3.5 mr-1.5 transition-transform flex-shrink-0"
              :class="{ 'rotate-90': expandedEnvs.has(env.id) }"
            />
            <ServerIcon class="h-4 w-4 mr-2 flex-shrink-0" />
            <span class="text-sm font-medium truncate flex-1">{{ env.name }}</span>
            <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click.stop="addGroup(env)" class="p-1 hover:bg-gray-200 rounded" title="Add group">
                <PlusIcon class="h-3 w-3" />
              </button>
              <button @click.stop="doExport(env)" class="p-1 hover:bg-gray-200 rounded" title="Export">
                <ArrowDownTrayIcon class="h-3 w-3" />
              </button>
              <button @click.stop="confirmDeleteEnv(env)" class="p-1 hover:bg-red-100 hover:text-red-600 rounded" title="Delete">
                <TrashIcon class="h-3 w-3" />
              </button>
            </div>
          </div>

          <!-- Groups & Routes Tree -->
          <div v-if="expandedEnvs.has(env.id) && envTrees[env.id]" class="ml-4">
            <div v-for="group in envTrees[env.id].groups" :key="group.id" class="mb-0.5">
              <!-- Group Header -->
              <div
                class="flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer group text-gray-600 hover:bg-gray-50"
                @click="toggleGroup(group.id)"
              >
                <ChevronRightIcon
                  class="h-3 w-3 mr-1.5 transition-transform flex-shrink-0"
                  :class="{ 'rotate-90': expandedGroups.has(group.id) }"
                />
                <FolderIcon class="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-gray-400" />
                <span class="text-xs font-medium truncate flex-1">{{ group.name }}</span>
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="addRoute(group)" class="p-0.5 hover:bg-gray-200 rounded" title="Add route">
                    <PlusIcon class="h-3 w-3" />
                  </button>
                  <button @click.stop="confirmDeleteGroup(group)" class="p-0.5 hover:bg-red-100 hover:text-red-600 rounded" title="Delete">
                    <TrashIcon class="h-3 w-3" />
                  </button>
                </div>
              </div>

              <!-- Routes -->
              <div v-if="expandedGroups.has(group.id)">
                <div
                  v-for="rt in group.routes" :key="rt.id"
                  class="flex items-center px-3 py-1.5 mx-2 ml-6 rounded cursor-pointer text-gray-600"
                  :class="mockStore.activeRouteId === rt.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50'"
                  @click="selectRoute(env.id, rt.id)"
                >
                  <span class="text-xs font-mono font-bold mr-1.5 flex-shrink-0" :class="methodColor(rt.method)">{{ rt.method }}</span>
                  <span class="text-xs truncate">{{ rt.pathPattern }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CreateGroupModal v-if="showCreateGroupModal" :environment-id="createGroupEnvId" @close="showCreateGroupModal = false" />
    <CreateRouteModal v-if="showCreateRouteModal" :group-id="createRouteGroupId" @close="showCreateRouteModal = false" />
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useMockStore } from '@/stores/mockStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  ChevronRightIcon, ServerIcon, FolderIcon, PlusIcon,
  ArrowDownTrayIcon, TrashIcon
} from '@heroicons/vue/24/outline'
import CreateGroupModal from './CreateGroupModal.vue'
import CreateRouteModal from './CreateRouteModal.vue'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const router = useRouter()

const expandedEnvs = ref(new Set())
const expandedGroups = ref(new Set())
const envTrees = reactive({})

const showCreateGroupModal = ref(false)
const createGroupEnvId = ref(null)
const showCreateRouteModal = ref(false)
const createRouteGroupId = ref(null)

async function toggleEnvironment(env) {
  if (expandedEnvs.value.has(env.id)) {
    expandedEnvs.value.delete(env.id)
  } else {
    expandedEnvs.value.add(env.id)
    await mockStore.selectEnvironment(env.id)
    router.push(`/mock/env/${env.id}`)
  }
}

watch(() => mockStore.activeEnvironment, (tree) => {
  if (tree) {
    envTrees[tree.id] = tree
    expandedEnvs.value.add(tree.id)
    // Auto-expand all groups
    for (const g of (tree.groups || [])) {
      expandedGroups.value.add(g.id)
    }
  }
}, { deep: true })

function toggleGroup(groupId) {
  if (expandedGroups.value.has(groupId)) {
    expandedGroups.value.delete(groupId)
  } else {
    expandedGroups.value.add(groupId)
  }
}

async function selectRoute(envId, routeId) {
  await mockStore.selectRoute(routeId)
  router.push(`/mock/env/${envId}/route/${routeId}`)
}

function methodColor(method) {
  const colors = {
    GET: 'text-green-600', POST: 'text-blue-600', PUT: 'text-amber-600',
    PATCH: 'text-purple-600', DELETE: 'text-red-600', ALL: 'text-gray-500'
  }
  return colors[method] || 'text-gray-500'
}

function addGroup(env) {
  createGroupEnvId.value = env.id
  showCreateGroupModal.value = true
}

function addRoute(group) {
  createRouteGroupId.value = group.id
  showCreateRouteModal.value = true
}

async function doExport(env) {
  try {
    const data = await mockStore.exportEnvironment(env.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${env.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-mock.json`
    a.click()
    URL.revokeObjectURL(url)
    notificationStore.showToast('Environment exported', 'success')
  } catch (error) {
    notificationStore.showToast('Failed to export', 'error')
  }
}

function confirmDeleteEnv(env) {
  Swal.fire({
    title: 'Delete environment?',
    text: `This will delete "${env.name}" and all its groups, routes, and rules.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Delete',
    preConfirm: async () => {
      await mockStore.deleteEnvironment(env.id)
      delete envTrees[env.id]
      expandedEnvs.value.delete(env.id)
    }
  })
}

function confirmDeleteGroup(group) {
  Swal.fire({
    title: 'Delete group?',
    text: `This will delete "${group.name}" and all its routes.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Delete',
    preConfirm: async () => {
      await mockStore.deleteGroup(group.id)
    }
  })
}
</script>
