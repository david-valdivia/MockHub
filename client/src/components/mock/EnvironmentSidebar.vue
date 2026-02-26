<template>
  <div class="bg-white border-r border-gray-200 h-screen flex flex-col overflow-hidden relative" :style="{ width: sidebarWidth + 'px', minWidth: '200px', maxWidth: '400px' }">
    <!-- Resize handle -->
    <div
      class="absolute top-0 right-0 w-1.5 h-full cursor-col-resize z-20 hover:bg-blue-400/40 transition-colors"
      :class="{ 'bg-blue-400/40': resizing }"
      @mousedown.prevent="startResize"
    ></div>
    <div class="flex-shrink-0 px-4 py-3 border-b border-gray-100">
      <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wider">Environments</h2>
      <p v-if="activeSyncServerName" class="text-[10px] text-blue-500 mt-0.5 truncate">
        Viewing <strong>{{ activeSyncServerName }}</strong>
      </p>
    </div>

    <div class="flex-1 overflow-y-auto py-2">
      <div v-if="mockStore.loading" class="flex justify-center py-8">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>

      <div v-else-if="mockStore.environments.length === 0" class="text-center py-8 px-4">
        <p class="text-gray-400 text-sm">No environments yet</p>
        <p v-if="activeSyncServerName" class="text-gray-300 text-xs mt-1">Pull from GitHub or create a new one</p>
      </div>

      <div v-else>
        <div v-for="env in mockStore.environments" :key="env.id" class="mb-1">
          <!-- Environment Header -->
          <div
            class="flex items-center px-3 py-2 mx-2 rounded-lg cursor-pointer group"
            :class="mockStore.activeEnvironmentId === env.id ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-700'"
            @click="toggleEnvironment(env)"
            @contextmenu.prevent="openEnvContextMenu($event, env)"
          >
            <ChevronRightIcon
              class="h-3.5 w-3.5 mr-1.5 transition-transform flex-shrink-0"
              :class="{ 'rotate-90': expandedEnvs.has(env.id) }"
            />
            <ServerIcon class="h-4 w-4 mr-2 flex-shrink-0" />
            <span class="text-sm font-medium truncate flex-1">{{ env.name }}<span v-if="env.basePath" class="text-gray-400 text-xs font-mono ml-1">{{ env.basePath }}</span></span>
            <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button @click.stop="addGroup(env)" class="p-1 hover:bg-gray-200 rounded" title="Add group">
                <PlusIcon class="h-3 w-3" />
              </button>
              <button v-if="hasCopyTargets" @click.stop="copyEnvTo(env)" class="p-1 hover:bg-blue-100 hover:text-blue-600 rounded" title="Copy To...">
                <CloudArrowUpIcon class="h-3 w-3" />
              </button>
              <button @click.stop="doExport(env)" class="p-1 hover:bg-gray-200 rounded" title="Export">
                <ArrowDownTrayIcon class="h-3 w-3" />
              </button>
              <button @click.stop="confirmDeleteEnv(env)" class="p-1 hover:bg-red-100 hover:text-red-600 rounded" title="Delete">
                <TrashIcon class="h-3 w-3" />
              </button>
            </div>
            <span v-if="syncDot('environment', env.id)" class="h-2.5 w-2.5 rounded-full border border-gray-300 flex-shrink-0 ml-1.5" :class="syncDot('environment', env.id)" :title="syncTitle('environment', env.id)"></span>
          </div>

          <!-- Groups & Routes Tree -->
          <div v-if="expandedEnvs.has(env.id) && envTrees[env.id]" class="ml-4">
            <div v-for="group in envTrees[env.id].groups" :key="group.id" class="mb-0.5">
              <!-- Group Header -->
              <div
                class="flex items-center px-3 py-1.5 mx-2 rounded cursor-pointer group text-gray-600 hover:bg-gray-50"
                @click="toggleGroup(group.id)"
                @contextmenu.prevent="openGroupContextMenu($event, env, group)"
              >
                <ChevronRightIcon
                  class="h-3 w-3 mr-1.5 transition-transform flex-shrink-0"
                  :class="{ 'rotate-90': expandedGroups.has(group.id) }"
                />
                <FolderIcon class="h-3.5 w-3.5 mr-1.5 flex-shrink-0 text-gray-400" />
                <span class="text-xs font-medium truncate flex-1">{{ group.name }}<span v-if="group.path" class="text-gray-400 font-mono ml-1">{{ group.path }}</span></span>
                <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button @click.stop="addRoute(group)" class="p-0.5 hover:bg-gray-200 rounded" title="Add route">
                    <PlusIcon class="h-3 w-3" />
                  </button>
                  <button v-if="hasAnyCopyTarget" @click.stop="copyGroupTo(group)" class="p-0.5 hover:bg-blue-100 hover:text-blue-600 rounded" title="Copy To...">
                    <CloudArrowUpIcon class="h-3 w-3" />
                  </button>
                  <button @click.stop="confirmDeleteGroup(group)" class="p-0.5 hover:bg-red-100 hover:text-red-600 rounded" title="Delete">
                    <TrashIcon class="h-3 w-3" />
                  </button>
                </div>
                <span v-if="syncDot('group', group.id)" class="h-2.5 w-2.5 rounded-full border border-gray-300 flex-shrink-0 ml-1.5" :class="syncDot('group', group.id)" :title="syncTitle('group', group.id)"></span>
              </div>

              <!-- Routes -->
              <div v-if="expandedGroups.has(group.id)">
                <div
                  v-for="rt in group.routes" :key="rt.id"
                  class="flex items-center px-3 py-1.5 mx-2 ml-6 rounded cursor-pointer text-gray-600 group/rt"
                  :class="mockStore.activeRouteId === rt.id ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50'"
                  @click="selectRoute(env.id, rt.id)"
                  @contextmenu.prevent="openContextMenu($event, env, group, rt)"
                >
                  <span class="text-xs font-mono font-bold mr-1.5 flex-shrink-0" :class="methodColor(rt.method)">{{ rt.method }}</span>
                  <span class="text-xs truncate flex-1">{{ rt.name || rt.pathPattern || '/' }}</span>
                  <span v-if="rt.name && rt.pathPattern" class="text-gray-400 text-[10px] font-mono ml-1 flex-shrink-0">{{ rt.pathPattern }}</span>
                  <button
                    @click.stop="copyRouteUrl(env, rt, group)"
                    class="p-0.5 text-gray-400 hover:text-blue-600 opacity-0 group-hover/rt:opacity-100 transition-opacity flex-shrink-0"
                    title="Copy mock URL"
                  >
                    <ClipboardDocumentIcon class="h-3 w-3" />
                  </button>
                  <span v-if="syncDot('route', rt.id)" class="h-2 w-2 rounded-full border border-gray-300 flex-shrink-0 ml-1" :class="syncDot('route', rt.id)" :title="syncTitle('route', rt.id)"></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Server Sync Panel -->
    <ServerSyncPanel />

    <!-- Documentation -->
    <div class="flex-shrink-0 border-t border-gray-200">
      <button
        @click="showDocs = !showDocs"
        class="w-full flex items-center px-4 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition"
      >
        <BookOpenIcon class="h-3.5 w-3.5 mr-2" />
        <span class="font-medium">Documentation</span>
        <ChevronRightIcon class="h-3 w-3 ml-auto transition-transform" :class="{ 'rotate-90': showDocs }" />
      </button>
    </div>

    <!-- Docs Modal -->
    <Teleport to="body">
      <div v-if="showDocs" class="fixed inset-0 z-[99998] bg-black/40" @click="showDocs = false"></div>
      <div v-if="showDocs" class="fixed inset-y-0 left-72 z-[99999] w-[480px] bg-white shadow-2xl border-r border-gray-200 flex flex-col">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="text-base font-semibold text-gray-800">MockHub Documentation</h2>
          <button @click="showDocs = false" class="p-1 text-gray-400 hover:text-gray-600 rounded">
            <XMarkIcon class="h-5 w-5" />
          </button>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6 text-xs text-gray-700" v-html="docsHtml"></div>
      </div>
    </Teleport>

    <CreateGroupModal v-if="showCreateGroupModal" :environment-id="createGroupEnvId" @close="showCreateGroupModal = false" />
    <CreateRouteModal v-if="showCreateRouteModal" :group-id="createRouteGroupId" @close="showCreateRouteModal = false" />

    <!-- Route Context Menu -->
    <Teleport to="body">
      <div
        v-if="ctxMenu.visible"
        class="fixed inset-0 z-[99998]"
        @click="closeContextMenu"
        @contextmenu.prevent="closeContextMenu"
      ></div>
      <div
        v-if="ctxMenu.visible"
        class="fixed z-[99999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
        :style="{ top: ctxMenu.y + 'px', left: ctxMenu.x + 'px' }"
      >
        <button @click="ctxCopyUrl" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <ClipboardDocumentIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Copy URL</span>
        </button>
        <button @click="ctxEditName" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PencilSquareIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Edit Name</span>
        </button>
        <button @click="ctxEditPath" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PencilSquareIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Edit Path</span>
        </button>
        <button @click="ctxDuplicate" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <DocumentDuplicateIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Duplicate</span>
        </button>
        <button v-if="hasAnyCopyTarget" @click="ctxCopyRouteTo" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <CloudArrowUpIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Copy To...</span>
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="ctxDelete" class="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2">
          <TrashIcon class="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </Teleport>

    <!-- Group Context Menu -->
    <Teleport to="body">
      <div
        v-if="groupCtxMenu.visible"
        class="fixed inset-0 z-[99998]"
        @click="closeGroupContextMenu"
        @contextmenu.prevent="closeGroupContextMenu"
      ></div>
      <div
        v-if="groupCtxMenu.visible"
        class="fixed z-[99999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
        :style="{ top: groupCtxMenu.y + 'px', left: groupCtxMenu.x + 'px' }"
      >
        <button @click="groupCtxEditName" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PencilSquareIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Edit Name</span>
        </button>
        <button @click="groupCtxEditPath" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PencilSquareIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Edit Path</span>
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="groupCtxAddRoute" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PlusIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Add Route</span>
        </button>
        <button v-if="hasAnyCopyTarget" @click="groupCtxCopyTo" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <CloudArrowUpIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Copy To...</span>
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="groupCtxDelete" class="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2">
          <TrashIcon class="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </Teleport>

    <!-- Environment Context Menu -->
    <Teleport to="body">
      <div
        v-if="envCtxMenu.visible"
        class="fixed inset-0 z-[99998]"
        @click="closeEnvContextMenu"
        @contextmenu.prevent="closeEnvContextMenu"
      ></div>
      <div
        v-if="envCtxMenu.visible"
        class="fixed z-[99999] bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
        :style="{ top: envCtxMenu.y + 'px', left: envCtxMenu.x + 'px' }"
      >
        <button @click="envCtxEditName" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PencilSquareIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Edit Name</span>
        </button>
        <button @click="envCtxEditPath" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PencilSquareIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Edit Path</span>
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="envCtxAddGroup" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <PlusIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Add Group</span>
        </button>
        <button v-if="hasCopyTargets" @click="envCtxCopyTo" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <CloudArrowUpIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Copy To...</span>
        </button>
        <button @click="envCtxExport" class="w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100 flex items-center space-x-2">
          <ArrowDownTrayIcon class="h-3.5 w-3.5 text-gray-400" />
          <span>Export</span>
        </button>
        <div class="border-t border-gray-100 my-1"></div>
        <button @click="envCtxDelete" class="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center space-x-2">
          <TrashIcon class="h-3.5 w-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useMockStore } from '@/stores/mockStore'
import { webhookApi } from '@/services/api'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  ChevronRightIcon, ServerIcon, FolderIcon, PlusIcon,
  ArrowDownTrayIcon, ArrowUpTrayIcon, TrashIcon, ClipboardDocumentIcon, DocumentDuplicateIcon, PencilSquareIcon,
  BookOpenIcon, XMarkIcon, CloudArrowUpIcon
} from '@heroicons/vue/24/outline'
import CreateGroupModal from './CreateGroupModal.vue'
import CreateRouteModal from './CreateRouteModal.vue'
import ServerSyncPanel from './ServerSyncPanel.vue'
import Swal from 'sweetalert2'

const mockStore = useMockStore()
const notificationStore = useNotificationStore()
const router = useRouter()

// Resizable sidebar
const sidebarWidth = ref(parseInt(localStorage.getItem('mockhub_sidebar_width') || '288'))
const resizing = ref(false)

function startResize(e) {
  resizing.value = true
  const startX = e.clientX
  const startWidth = sidebarWidth.value
  function onMouseMove(ev) {
    const newWidth = Math.min(400, Math.max(200, startWidth + (ev.clientX - startX)))
    sidebarWidth.value = newWidth
  }
  function onMouseUp() {
    resizing.value = false
    localStorage.setItem('mockhub_sidebar_width', String(sidebarWidth.value))
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

const expandedEnvs = ref(new Set())
const expandedGroups = ref(new Set())
const envTrees = reactive({})

const showDocs = ref(false)
const docsHtml = computed(() => buildDocsHtml())
const showCreateGroupModal = ref(false)
const createGroupEnvId = ref(null)
const showCreateRouteModal = ref(false)
const createRouteGroupId = ref(null)

const activeSyncServerName = computed(() => {
  if (!mockStore.activeSyncServerId) return null
  const server = mockStore.servers.find(s => s.id === mockStore.activeSyncServerId)
  return server?.name || null
})

// Show "Copy To..." when there's at least one other server to copy to
// On Local: need at least 1 GitHub server. On a server: Local is always available.
const hasCopyTargets = computed(() => {
  if (mockStore.activeSyncServerId) return true // can always copy to Local
  return mockStore.servers.length > 0 // on Local, need at least 1 server
})
// Groups and routes can always be copied (even within same server to another env/group)
const hasAnyCopyTarget = computed(() => {
  return mockStore.environments.length > 0
})

// Sync status dots: show when viewing a GitHub server
function syncDot(entityType, entityId) {
  if (!mockStore.activeSyncServerId) return null
  const status = mockStore.getSyncStatusFor(entityType, entityId)
  if (status === 'synced') return 'bg-green-400'
  if (status === 'modified') return 'bg-amber-400'
  return 'bg-gray-300'
}

function syncTitle(entityType, entityId) {
  if (!mockStore.activeSyncServerId) return ''
  const status = mockStore.getSyncStatusFor(entityType, entityId)
  if (status === 'synced') return 'Synced with GitHub'
  if (status === 'modified') return 'Modified since last push'
  return 'Not pushed to GitHub'
}

async function refreshEnvTree(envId) {
  try {
    const res = await webhookApi.getEnvironmentTree(envId)
    envTrees[envId] = res.data
    for (const g of (res.data.groups || [])) {
      expandedGroups.value.add(g.id)
    }
  } catch (_) {}
}

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

function buildFullUrl(env, group, rt) {
  const parts = [env.basePath || '', group?.path || '', rt.pathPattern || ''].filter(p => p !== '')
  let full = parts.join('/')
  full = full.replace(/\/+/g, '/')
  if (!full.startsWith('/')) full = '/' + full
  if (full.length > 1 && full.endsWith('/')) full = full.slice(0, -1)
  return full || '/'
}

function copyRouteUrl(env, rt, group) {
  const origin = window.location.origin
  const fullPath = buildFullUrl(env, group, rt)
  const url = `${origin}${fullPath}`
  navigator.clipboard.writeText(url)
    .then(() => notificationStore.showToast('URL copied', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
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

// --- Server picker (includes Local, excludes current) ---
async function pickTargetServer() {
  // Build the list: Local + all GitHub servers, excluding the one we're currently viewing
  const currentServerId = mockStore.activeSyncServerId // null = Local
  const targets = []
  if (currentServerId !== null) {
    targets.push({ id: 'local', name: 'Local' })
  }
  for (const s of mockStore.servers) {
    if (s.id !== currentServerId) {
      targets.push({ id: s.id, name: s.name })
    }
  }
  if (targets.length === 0) return null
  if (targets.length === 1) return targets[0]

  const options = {}
  targets.forEach(t => { options[t.id] = t.name })
  const { value } = await Swal.fire({
    title: 'Copy To...',
    text: 'Select target server',
    input: 'select',
    inputOptions: options,
    showCancelButton: true,
    confirmButtonText: 'Select',
    inputValidator: (val) => { if (!val) return 'Please select a server' },
    customClass: {
      input: 'swal-select-bordered'
    }
  })
  if (!value) return null
  return targets.find(t => String(t.id) === String(value))
}

// --- Copy To... for environments ---
async function copyEnvTo(env) {
  const target = await pickTargetServer()
  if (!target) return
  const { isConfirmed } = await Swal.fire({
    title: 'Copy To ' + target.name + '?',
    text: `Copy "${env.name}" and all its groups/routes to ${target.name}`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Copy'
  })
  if (!isConfirmed) return
  try {
    const newEnv = await mockStore.copyEnvironmentToServer(env.id, target.id)
    if (newEnv?.id) await refreshEnvTree(newEnv.id)
    notificationStore.showToast(`Copied "${env.name}" to ${target.name}`, 'success')
  } catch (error) {
    // Handle conflict: environment already exists on target
    if (error.response && error.response.status === 409 && error.response.data?.error === 'conflict') {
      const existing = error.response.data.existing
      const { value: strategy } = await Swal.fire({
        title: 'Environment already exists',
        html: `<p class="text-sm text-gray-600 mb-2">"<strong>${existing.name}</strong>" with path <code>${existing.basePath || '/'}</code> already exists on <strong>${target.name}</strong>.</p>`,
        icon: 'warning',
        input: 'select',
        inputOptions: {
          'keep_both': 'Keep both (create copy with modified path)',
          'replace': 'Replace (overwrite existing)'
        },
        inputValue: 'keep_both',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Continue',
        customClass: { input: 'swal-select-bordered' }
      })
      if (!strategy) return
      try {
        const retryEnv = await mockStore.copyEnvironmentToServer(env.id, target.id, strategy)
        const retryId = strategy === 'replace' ? existing.id : retryEnv?.id
        if (retryId) await refreshEnvTree(retryId)
        const msg = strategy === 'replace'
          ? `Replaced "${env.name}" on ${target.name}`
          : `Copied "${env.name}" to ${target.name} (kept both)`
        notificationStore.showToast(msg, 'success')
      } catch (retryError) {
        notificationStore.showToast(retryError.message || 'Copy failed', 'error')
      }
    } else {
      notificationStore.showToast(error.message || 'Copy failed', 'error')
    }
  }
}

// --- Pick target server (includes current for group/route copies) ---
async function pickTargetServerForCopy() {
  const currentServerId = mockStore.activeSyncServerId
  const targets = []
  // Include current server (for copying within same server)
  targets.push({ id: currentServerId === null ? 'local' : currentServerId, name: currentServerId === null ? 'Local' : (mockStore.servers.find(s => s.id === currentServerId)?.name || 'Current') })
  // Add other servers
  if (currentServerId !== null) {
    targets.push({ id: 'local', name: 'Local' })
  }
  for (const s of mockStore.servers) {
    if (s.id !== currentServerId) {
      targets.push({ id: s.id, name: s.name })
    }
  }
  if (targets.length === 1) return targets[0]
  const options = {}
  targets.forEach(t => { options[t.id] = t.name })
  const { value } = await Swal.fire({
    title: 'Copy To...',
    text: 'Select target server',
    input: 'select',
    inputOptions: options,
    showCancelButton: true,
    confirmButtonText: 'Select',
    inputValidator: (val) => { if (!val) return 'Please select a server' },
    customClass: { input: 'swal-select-bordered' }
  })
  if (!value) return null
  return targets.find(t => String(t.id) === String(value))
}

// --- Pick target environment on a server ---
async function pickTargetEnvironment(serverId, excludeEnvId) {
  const targetServerId = serverId === 'local' ? 'local' : serverId
  const res = await webhookApi.getEnvironments({ server_id: targetServerId })
  let envs = res.data
  if (excludeEnvId) envs = envs.filter(e => e.id !== excludeEnvId)
  if (envs.length === 0) {
    notificationStore.showToast('No environments available on target server', 'info')
    return null
  }
  if (envs.length === 1) return envs[0]
  const options = {}
  envs.forEach(e => { options[e.id] = e.name + (e.basePath ? ' (' + e.basePath + ')' : '') })
  const { value } = await Swal.fire({
    title: 'Select target environment',
    input: 'select',
    inputOptions: options,
    showCancelButton: true,
    confirmButtonText: 'Select',
    inputValidator: val => { if (!val) return 'Please select an environment' },
    customClass: { input: 'swal-select-bordered' }
  })
  if (!value) return null
  return envs.find(e => String(e.id) === String(value))
}

// --- Pick target group in an environment ---
async function pickTargetGroup(envId, excludeGroupId) {
  const res = await webhookApi.getGroups(envId)
  let groups = res.data
  if (excludeGroupId) groups = groups.filter(g => g.id !== excludeGroupId)
  if (groups.length === 0) {
    notificationStore.showToast('No groups available in target environment', 'info')
    return null
  }
  if (groups.length === 1) return groups[0]
  const options = {}
  groups.forEach(g => { options[g.id] = g.name + (g.path ? ' (' + g.path + ')' : '') })
  const { value } = await Swal.fire({
    title: 'Select target group',
    input: 'select',
    inputOptions: options,
    showCancelButton: true,
    confirmButtonText: 'Select',
    inputValidator: val => { if (!val) return 'Please select a group' },
    customClass: { input: 'swal-select-bordered' }
  })
  if (!value) return null
  return groups.find(g => String(g.id) === String(value))
}

// --- Copy To... for groups ---
async function copyGroupTo(group) {
  const target = await pickTargetServerForCopy()
  if (!target) return
  const targetEnv = await pickTargetEnvironment(target.id)
  if (!targetEnv) return
  try {
    await mockStore.copyGroupTo(group.id, targetEnv.id)
    await refreshEnvTree(targetEnv.id)
    notificationStore.showToast(`Copied group "${group.name}" to "${targetEnv.name}"`, 'success')
  } catch (error) {
    if (error.response?.status === 409 && error.response.data?.error === 'conflict') {
      const existing = error.response.data.existing
      const { value: strategy } = await Swal.fire({
        title: 'Group already exists',
        html: `<p class="text-sm text-gray-600">"<strong>${existing.name}</strong>" already exists in "<strong>${targetEnv.name}</strong>".</p>`,
        icon: 'warning',
        input: 'select',
        inputOptions: {
          'keep_both': 'Keep both (create copy with different name)',
          'replace': 'Replace (overwrite existing group and routes)'
        },
        inputValue: 'keep_both',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Continue',
        customClass: { input: 'swal-select-bordered' }
      })
      if (!strategy) return
      try {
        await mockStore.copyGroupTo(group.id, targetEnv.id, strategy)
        await refreshEnvTree(targetEnv.id)
        const msg = strategy === 'replace'
          ? `Replaced group "${group.name}" in "${targetEnv.name}"`
          : `Copied group "${group.name}" to "${targetEnv.name}" (kept both)`
        notificationStore.showToast(msg, 'success')
      } catch (retryError) {
        notificationStore.showToast(retryError.message || 'Copy failed', 'error')
      }
    } else {
      notificationStore.showToast(error.message || 'Copy failed', 'error')
    }
  }
}

// --- Copy To... for routes ---
async function copyRouteTo(route) {
  const target = await pickTargetServerForCopy()
  if (!target) return
  const targetEnv = await pickTargetEnvironment(target.id)
  if (!targetEnv) return
  const targetGroup = await pickTargetGroup(targetEnv.id)
  if (!targetGroup) return
  try {
    await mockStore.copyRouteTo(route.id, targetGroup.id)
    await refreshEnvTree(targetEnv.id)
    notificationStore.showToast(`Copied route to "${targetGroup.name}"`, 'success')
  } catch (error) {
    if (error.response?.status === 409 && error.response.data?.error === 'conflict') {
      const existing = error.response.data.existing
      const { value: strategy } = await Swal.fire({
        title: 'Route already exists',
        html: `<p class="text-sm text-gray-600">"<strong>${existing.method} ${existing.pathPattern || '/'}</strong>" already exists in group "<strong>${targetGroup.name}</strong>".</p>`,
        icon: 'warning',
        input: 'select',
        inputOptions: {
          'keep_both': 'Keep both (create copy with modified path)',
          'replace': 'Replace (overwrite existing route and rules)'
        },
        inputValue: 'keep_both',
        showCancelButton: true,
        cancelButtonText: 'Cancel',
        confirmButtonText: 'Continue',
        customClass: { input: 'swal-select-bordered' }
      })
      if (!strategy) return
      try {
        await mockStore.copyRouteTo(route.id, targetGroup.id, strategy)
        await refreshEnvTree(targetEnv.id)
        const msg = strategy === 'replace'
          ? `Replaced route in "${targetGroup.name}"`
          : `Copied route to "${targetGroup.name}" (kept both)`
        notificationStore.showToast(msg, 'success')
      } catch (retryError) {
        notificationStore.showToast(retryError.message || 'Copy failed', 'error')
      }
    } else {
      notificationStore.showToast(error.message || 'Copy failed', 'error')
    }
  }
}

// --- Route Context Menu ---
const ctxMenu = reactive({ visible: false, x: 0, y: 0, env: null, group: null, route: null })

function openContextMenu(event, env, group, rt) {
  closeGroupContextMenu()
  closeEnvContextMenu()
  ctxMenu.x = event.clientX
  ctxMenu.y = event.clientY
  ctxMenu.env = env
  ctxMenu.group = group
  ctxMenu.route = rt
  ctxMenu.visible = true
}

function closeContextMenu() {
  ctxMenu.visible = false
}

function ctxCopyUrl() {
  copyRouteUrl(ctxMenu.env, ctxMenu.route, ctxMenu.group)
  closeContextMenu()
}

async function ctxEditName() {
  const { route } = ctxMenu
  closeContextMenu()
  const { value: newName } = await Swal.fire({
    title: 'Edit route name',
    input: 'text',
    inputLabel: 'Name (descriptive label)',
    inputValue: route.name || '',
    showCancelButton: true,
    confirmButtonText: 'Save'
  })
  if (newName === undefined) return
  try {
    await mockStore.updateRoute(route.id, { name: newName.trim() })
    notificationStore.showToast('Route name updated', 'success')
  } catch (e) {
    notificationStore.showToast('Failed to update route name', 'error')
  }
}

async function ctxEditPath() {
  const { route } = ctxMenu
  closeContextMenu()

  const { value } = await Swal.fire({
    title: 'Edit route path',
    input: 'text',
    inputLabel: 'Path (optional, e.g. /charges/:id)',
    inputValue: route.pathPattern || '',
    showCancelButton: true,
    confirmButtonText: 'Save'
  })

  if (value === undefined) return

  try {
    await mockStore.updateRoute(route.id, { path_pattern: value.trim() })
    notificationStore.showToast('Route path updated', 'success')
  } catch (e) {
    notificationStore.showToast('Failed to update route path', 'error')
  }
}

async function ctxDuplicate() {
  const { env, group, route } = ctxMenu
  closeContextMenu()
  try {
    // Fetch full route with rules
    const response = await webhookApi.getRoute(route.id)
    const full = response.data

    // Create duplicated route
    const newRoute = await mockStore.createRoute(group.id, {
      method: full.method,
      path_pattern: full.pathPattern + '-copy',
      capture_requests: full.captureRequests
    })

    // Duplicate rules
    if (full.rules && full.rules.length > 0) {
      for (const rule of full.rules) {
        await mockStore.createRule(newRoute.id, {
          priority: rule.priority,
          conditions: rule.conditions || [],
          status_code: rule.statusCode,
          content_type: rule.contentType,
          body: rule.body,
          delay: rule.delay
        })
      }
    }

    notificationStore.showToast(`Route duplicated: ${full.pathPattern}-copy`, 'success')
  } catch (error) {
    notificationStore.showToast('Failed to duplicate route', 'error')
  }
}

async function ctxCopyRouteTo() {
  const { route } = ctxMenu
  closeContextMenu()
  await copyRouteTo(route)
}

function ctxDelete() {
  const { route } = ctxMenu
  closeContextMenu()
  Swal.fire({
    title: 'Delete route?',
    text: `Delete "${route.method} ${route.pathPattern}" and all its rules?`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Delete',
    preConfirm: async () => {
      await mockStore.deleteRoute(route.id)
    }
  })
}

// --- Group Context Menu ---
const groupCtxMenu = reactive({ visible: false, x: 0, y: 0, env: null, group: null })

function openGroupContextMenu(event, env, group) {
  closeContextMenu()
  closeEnvContextMenu()
  groupCtxMenu.x = event.clientX
  groupCtxMenu.y = event.clientY
  groupCtxMenu.env = env
  groupCtxMenu.group = group
  groupCtxMenu.visible = true
}

function closeGroupContextMenu() {
  groupCtxMenu.visible = false
}

function groupCtxAddRoute() {
  addRoute(groupCtxMenu.group)
  closeGroupContextMenu()
}

async function groupCtxCopyTo() {
  const { group } = groupCtxMenu
  closeGroupContextMenu()
  await copyGroupTo(group)
}

function groupCtxDelete() {
  const { group } = groupCtxMenu
  closeGroupContextMenu()
  confirmDeleteGroup(group)
}

async function groupCtxEditName() {
  const { group } = groupCtxMenu
  closeGroupContextMenu()
  const { value: newName } = await Swal.fire({
    title: 'Edit group name',
    input: 'text',
    inputLabel: 'Name',
    inputValue: group.name,
    showCancelButton: true,
    confirmButtonText: 'Save',
    inputValidator: (val) => { if (!val || !val.trim()) return 'Name cannot be empty' }
  })
  if (!newName) return
  try {
    await mockStore.updateGroup(group.id, { name: newName.trim() })
    notificationStore.showToast('Group name updated', 'success')
  } catch (e) {
    notificationStore.showToast('Failed to update group name', 'error')
  }
}

async function groupCtxEditPath() {
  const { group } = groupCtxMenu
  closeGroupContextMenu()
  const { value } = await Swal.fire({
    title: 'Edit group path',
    input: 'text',
    inputLabel: 'Path (optional, e.g. /:clientId/items)',
    inputValue: group.path || '',
    showCancelButton: true,
    confirmButtonText: 'Save'
  })
  if (value === undefined) return
  try {
    await mockStore.updateGroup(group.id, { path: value.trim() })
    notificationStore.showToast('Group path updated', 'success')
  } catch (e) {
    notificationStore.showToast('Failed to update group path', 'error')
  }
}

// --- Environment Context Menu ---
const envCtxMenu = reactive({ visible: false, x: 0, y: 0, env: null })

function openEnvContextMenu(event, env) {
  closeContextMenu()
  closeGroupContextMenu()
  envCtxMenu.x = event.clientX
  envCtxMenu.y = event.clientY
  envCtxMenu.env = env
  envCtxMenu.visible = true
}

function closeEnvContextMenu() {
  envCtxMenu.visible = false
}

async function envCtxEditName() {
  const { env } = envCtxMenu
  closeEnvContextMenu()
  const { value: newName } = await Swal.fire({
    title: 'Edit environment name',
    input: 'text',
    inputLabel: 'Name',
    inputValue: env.name,
    showCancelButton: true,
    confirmButtonText: 'Save',
    inputValidator: (val) => { if (!val || !val.trim()) return 'Name cannot be empty' }
  })
  if (!newName) return
  try {
    await mockStore.updateEnvironment(env.id, { name: newName.trim() })
    notificationStore.showToast('Environment name updated', 'success')
  } catch (e) {
    notificationStore.showToast('Failed to update environment name', 'error')
  }
}

async function envCtxEditPath() {
  const { env } = envCtxMenu
  closeEnvContextMenu()
  const { value } = await Swal.fire({
    title: 'Edit environment path',
    input: 'text',
    inputLabel: 'Path (optional, e.g. /api/v1)',
    inputValue: env.basePath || '',
    showCancelButton: true,
    confirmButtonText: 'Save'
  })
  if (value === undefined) return
  try {
    await mockStore.updateEnvironment(env.id, { base_path: value.trim() })
    notificationStore.showToast('Environment path updated', 'success')
  } catch (e) {
    notificationStore.showToast('Failed to update environment path', 'error')
  }
}

function envCtxAddGroup() {
  addGroup(envCtxMenu.env)
  closeEnvContextMenu()
}

async function envCtxCopyTo() {
  const { env } = envCtxMenu
  closeEnvContextMenu()
  await copyEnvTo(env)
}

function envCtxExport() {
  doExport(envCtxMenu.env)
  closeEnvContextMenu()
}

function envCtxDelete() {
  const { env } = envCtxMenu
  closeEnvContextMenu()
  confirmDeleteEnv(env)
}

function buildDocsHtml() {
  const b = (s) => s.replace(/\{\{/g, '<span class="font-mono">{{').replace(/\}\}/g, '}}</span>')
  const sec = (title, content) => `<section><h3 class="text-sm font-bold text-gray-900 mb-2">${title}</h3>${content}</section>`
  const h4 = (title) => `<h4 class="font-semibold text-gray-800 mt-3 mb-1">${title}</h4>`
  const row = (col1, col2, cls = '') => `<tr class="border-b border-gray-100"><td class="py-1 font-mono ${cls}">${col1}</td><td class="py-1">${col2}</td></tr>`
  const table = (rows) => `<table class="w-full"><tbody>${rows}</tbody></table>`
  const tpl = (v, cls = 'text-rose-600') => `<span class="font-mono ${cls}">{{${v}}}</span>`

  return `<div class="space-y-6">
    ${sec('Overview', '<p class="leading-relaxed">MockHub is a configurable API mocker. Create <strong>Environments</strong> with a base path, organize endpoints into <strong>Groups</strong>, define <strong>Routes</strong> with path patterns, and configure <strong>Rules</strong> with conditions and dynamic response templates.</p>')}

    ${sec('Structure', `<div class="bg-gray-50 rounded-lg p-3 font-mono text-[11px] leading-relaxed">
      <div>Environment <span class="text-gray-400">(base_path: /api/v1)</span></div>
      <div class="ml-3">└ Group <span class="text-gray-400">(Users, Products...)</span></div>
      <div class="ml-6">└ Route <span class="text-gray-400">(POST /login, GET /:id)</span></div>
      <div class="ml-9">└ Rule <span class="text-gray-400">(conditions → response)</span></div>
    </div>`)}

    ${sec('Path Patterns', `<p class="mb-2">Routes use Express-style path patterns:</p>
      ${table(
        row('/users', 'Exact match', 'text-purple-700') +
        row('/users/:id', 'Named param → params.id', 'text-purple-700') +
        row('/files/:path+', 'One or more segments', 'text-purple-700') +
        row('/files/:path*', 'Zero or more segments', 'text-purple-700')
      )}`)}

    ${sec('Rules', `<p class="leading-relaxed">Rules are evaluated in <strong>priority order</strong> (lower = first). First match wins. No match → default 200 OK.</p>
      <ul class="mt-2 space-y-1 list-disc list-inside text-gray-600">
        <li><strong>Name</strong> — optional label for the rule</li>
        <li><strong>Priority</strong> — lower = evaluated first. Drag to reorder</li>
        <li><strong>Conditions</strong> — AND/OR logic (click toggle between conditions)</li>
        <li><strong>Response</strong> — status code, content type, body with templates, delay</li>
        <li><strong>Ctrl+S</strong> — quick save when rule is expanded</li>
      </ul>`)}

    ${sec('Condition Operators', table(
      row('equals', 'Exact string match', 'text-blue-700') +
      row('not_equals', 'Does not equal', 'text-blue-700') +
      row('contains', 'String contains value', 'text-blue-700') +
      row('not_contains', 'String does not contain', 'text-blue-700') +
      row('exists', 'Field is present and not null', 'text-blue-700') +
      row('not_exists', 'Field is absent or null', 'text-blue-700') +
      row('gt / gte / lt / lte', 'Numeric comparisons', 'text-blue-700') +
      row('matches', 'Regular expression match', 'text-blue-700') +
      row('exists_in_logs', 'Value was seen in previous request logs', 'text-cyan-700') +
      row('not_exists_in_logs', 'Value NOT seen in previous logs', 'text-cyan-700')
    ))}

    ${sec('Condition Fields', `<p class="mb-2">Dot-notation for nested values. Headers are <strong>case-insensitive</strong>.</p>
      ${table(
        row('body.email', 'Request body field', 'text-green-700') +
        row('body.user.name', 'Nested body field', 'text-green-700') +
        row('params.id', 'URL path parameter', 'text-green-700') +
        row('query.page', 'Query string parameter', 'text-green-700') +
        row('headers.authorization', 'Request header', 'text-blue-700') +
        row('method', 'HTTP method (GET, POST...)', 'text-purple-700')
      )}`)}

    ${sec('AND/OR Logic', `<p class="leading-relaxed">Click the <span class="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-700 rounded-full">AND</span> / <span class="inline-block px-1.5 py-0.5 text-[10px] font-bold bg-orange-100 text-orange-700 rounded-full">OR</span> toggle between conditions:</p>
      <div class="bg-gray-50 rounded-lg p-3 font-mono text-[11px] mt-2">
        <div>A <span class="text-blue-600 font-bold">AND</span> B <span class="text-orange-600 font-bold">OR</span> C <span class="text-blue-600 font-bold">AND</span> D</div>
        <div class="text-gray-500 mt-1">= (A AND B) OR (C AND D)</div>
      </div>`)}

    ${sec('Template Variables', `<p class="mb-2">Use <code class="px-1 py-0.5 bg-gray-100 rounded">{{}}</code> in response bodies. Supports fallback pipes: <code class="px-1 py-0.5 bg-gray-100 rounded">{{a|b|"default"}}</code></p>

      ${h4('Request Data')}
      ${table(
        row('{{body.field}}', 'Request body value', 'text-green-700') +
        row('{{params.id}}', 'URL path parameter', 'text-green-700') +
        row('{{query.param}}', 'Query string value', 'text-green-700') +
        row('{{headers.x-api-key}}', 'Header value', 'text-green-700') +
        row('{{method}}', 'HTTP method', 'text-green-700')
      )}

      ${h4('Identifiers')}
      ${table(
        row('{{$uuid}}', 'Random UUID v4', 'text-rose-600') +
        row('{{$randomInt}}', 'Random integer 0-999999', 'text-rose-600') +
        row('{{$randomFloat}}', 'Random float (2 decimals)', 'text-rose-600') +
        row('{{$randomString:16}}', 'Random hex string of N chars', 'text-rose-600') +
        row('{{$seq}}', 'Auto-incrementing counter', 'text-rose-600')
      )}

      ${h4('Date & Time')}
      ${table(
        row('{{$timestamp}}', 'ISO 8601 datetime', 'text-blue-600') +
        row('{{$date}}', 'YYYY-MM-DD', 'text-blue-600') +
        row('{{$time}}', 'HH:MM:SS', 'text-blue-600') +
        row('{{$now}}', 'Unix timestamp (ms)', 'text-blue-600')
      )}

      ${h4('Random Data')}
      ${table(
        row('{{$randomBool}}', 'true or false', 'text-amber-600') +
        row('{{$randomEmail}}', 'Random email', 'text-amber-600') +
        row('{{$randomName}}', 'Random name', 'text-amber-600') +
        row('{{$enum:a,b,c}}', 'Random pick from list', 'text-amber-600')
      )}

      ${h4('Log Data (requires exists_in_logs)')}
      ${table(
        row('{{logs.requestBody.*}}', 'First (oldest) matching log request', 'text-cyan-700') +
        row('{{logs.responseBody.*}}', 'First matching log response (parsed)', 'text-cyan-700') +
        row('{{logs.responseStatus}}', 'First matching log status', 'text-cyan-700') +
        row('{{lastlog.requestBody.*}}', 'Last (newest) matching log request', 'text-orange-700') +
        row('{{lastlog.responseBody.*}}', 'Last matching log response', 'text-orange-700') +
        row('{{lastlog.timestamp}}', 'Last matching log timestamp', 'text-orange-700')
      )}

      ${h4('Advanced')}
      ${table(
        row('{{a|b|"fallback"}}', 'Pipe: try each, use first non-null', 'text-purple-700') +
        row('{{$repeat:3:item_$i}}', 'Repeat template N times ($i = index)', 'text-purple-700')
      )}`)}

    ${sec('Keyboard Shortcuts', table(
      row('<kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+S</kbd>', 'Save expanded rule', '') +
      row('<kbd class="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-mono">Ctrl+Z</kbd>', 'Undo in response body editor', '')
    ))}

    ${sec('Tips', `<ul class="space-y-1.5 list-disc list-inside text-gray-600">
      <li><strong>Right-click</strong> routes in sidebar for copy URL, rename, duplicate, delete</li>
      <li><strong>Drag</strong> rules to reorder priorities</li>
      <li><strong>Beautify</strong> button formats JSON/XML in response body</li>
      <li><strong>Insert Tag</strong> panel provides clickable template variables</li>
      <li><strong>Copy AI Instructions</strong> generates a prompt for AI to create rules</li>
      <li><strong>Bulk Add Rules</strong> imports JSON array of rules</li>
      <li><strong>Export/Import</strong> environments as JSON files</li>
      <li>Supports both <strong>JSON</strong> and <strong>XML</strong> request/response bodies</li>
      <li>Header matching is <strong>case-insensitive</strong> (X-Api-Key = x-api-key)</li>
      <li><strong>Capture Requests</strong> logs all incoming requests for debugging</li>
    </ul>`)}
  </div>`
}
</script>
