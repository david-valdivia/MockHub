<template>
  <div id="app" class="min-h-screen bg-gray-50">
    <router-view />
    <ToastNotification />
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useNotificationStore } from './stores/notificationStore'
import ToastNotification from './components/ToastNotification.vue'

const notificationStore = useNotificationStore()

onMounted(async () => {
  await notificationStore.initialize()
})
</script>
