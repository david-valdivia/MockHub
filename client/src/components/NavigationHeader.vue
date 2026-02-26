<template>
  <nav class="bg-blue-600" style="box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
    <div class="px-6">
      <div class="flex justify-between items-center h-16">
        <div class="flex items-center">
          <img src="/favicon.png" alt="MockHub" class="h-8 w-8 mr-3 rounded" />
          <span class="text-white text-xl font-bold">
            MockHub
          </span>
        </div>
        
        <div class="flex items-center space-x-4">
          <!-- Settings Dropdown with Connection Status -->
          <div class="relative">
            <button 
              ref="dropdownRef"
              class="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 rounded-lg transition duration-200 border border-blue-600" 
              type="button" 
              @click="toggleDropdown"
            >
              <!-- Connection Status Indicator -->
              <div :class="webhookStore.isConnected ? 'w-2 h-2 bg-green-400 rounded-full' : 'w-2 h-2 bg-red-400 rounded-full'"></div>
              <span class="text-sm font-medium">{{ connectionStatusText }}</span>
              <CogIcon class="h-4 w-4" />
            </button>
            
            <div 
              ref="dropdownMenu"
              class="dropdown-menu absolute right-0 z-50 mt-2 w-80 rounded-lg bg-white border border-gray-200" 
              :class="{ 'show': isDropdownOpen }"
              style="box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);"
            >
              <!-- Connection & Status Info -->
              <div class="px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <div class="flex justify-between items-center mb-2">
                  <span class="text-sm font-medium text-gray-700">Server Status</span>
                  <span :class="webhookStore.isConnected ? 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800' : 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800'">
                    <WifiIcon v-if="webhookStore.isConnected" class="h-3 w-3 mr-1" />
                    <NoSymbolIcon v-else class="h-3 w-3 mr-1" />
                    {{ connectionStatusText }}
                  </span>
                </div>
                <div class="flex justify-between items-center">
                  <span class="text-sm font-medium text-gray-700">Notifications</span>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    <BellIcon class="h-3 w-3 mr-1" />
                    {{ notificationStore.notificationStatusText }}
                  </span>
                </div>
              </div>
              
              <!-- Toggle Notifications -->
              <button 
                class="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center space-x-3 transition duration-200" 
                @click="handleNotificationToggle"
              >
                <BellSlashIcon v-if="notificationEnabled" class="h-5 w-5 text-amber-600" />
                <BellIcon v-else class="h-5 w-5 text-green-600" />
                <span class="text-sm font-medium text-gray-900">
                  {{ notificationEnabled ? 'Disable Notifications' : 'Enable Notifications' }}
                </span>
              </button>
              
              <hr class="border-gray-100">
              
              <!-- Notification Settings -->
              <button 
                class="w-full px-4 py-3 text-left hover:bg-blue-50 flex items-center space-x-3 transition duration-200 rounded-b-lg" 
                @click="openNotificationSettings"
              >
                <AdjustmentsHorizontalIcon class="h-5 w-5 text-blue-600" />
                <span class="text-sm font-medium text-gray-900">Notification Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useWebhookStore } from '@/stores/webhookStore'
import { useNotificationStore } from '@/stores/notificationStore'
import {
  CogIcon,
  BellIcon,
  BellSlashIcon,
  WifiIcon,
  NoSymbolIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/vue/24/outline'

const webhookStore = useWebhookStore()
const notificationStore = useNotificationStore()
const dropdownRef = ref(null)
const dropdownMenu = ref(null)
const isDropdownOpen = ref(false)

const notificationEnabled = computed(() => notificationStore.notificationEnabled)

const connectionStatusText = computed(() => 
  webhookStore.isConnected ? 'Connected' : 'Disconnected'
)

const toggleDropdown = (event) => {
  event.stopPropagation()
  isDropdownOpen.value = !isDropdownOpen.value
}

const closeDropdown = () => {
  isDropdownOpen.value = false
}

const handleNotificationToggle = () => {
  notificationStore.toggleNotifications()
  closeDropdown()
}

const openNotificationSettings = () => {
  // TODO: Implement modal opening for notification settings
  console.log('Opening notification settings modal')
  closeDropdown()
}

// Close dropdown when clicking outside
const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    closeDropdown()
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>