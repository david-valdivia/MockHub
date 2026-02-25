import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'

import App from './App.vue'
import MockDashboard from './views/MockDashboard.vue'
import './style.css'

const routes = [
  { path: '/', name: 'MockDashboard', component: MockDashboard },
  { path: '/mock/env/:envId', name: 'MockEnvironment', component: MockDashboard, props: true },
  { path: '/mock/env/:envId/route/:routeId', name: 'MockRoute', component: MockDashboard, props: true },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

const pinia = createPinia()

const app = createApp(App)
app.use(router)
app.use(pinia)
app.mount('#app')
