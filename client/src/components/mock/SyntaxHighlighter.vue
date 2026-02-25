<template>
  <div class="relative group/sh">
    <div
      class="text-xs font-mono rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all"
      :class="bgClass"
      v-html="highlighted"
    ></div>
    <button
      @click="copyContent"
      class="absolute top-2 right-2 p-1 rounded bg-white/80 border border-gray-200 text-gray-400 hover:text-gray-700 opacity-0 group-hover/sh:opacity-100 transition-opacity"
      title="Copy"
    >
      <ClipboardDocumentIcon class="h-3.5 w-3.5" />
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import { useNotificationStore } from '@/stores/notificationStore'

const props = defineProps({
  content: { type: [String, Object], default: '' },
  format: { type: String, default: 'json' }, // 'json' | 'xml' | 'auto'
  maxHeight: { type: String, default: 'max-h-64' },
  bg: { type: String, default: 'gray' } // 'gray' | 'blue'
})

const notificationStore = useNotificationStore()

const bgClass = computed(() => {
  const classes = [props.maxHeight]
  classes.push(props.bg === 'blue' ? 'bg-blue-50' : 'bg-gray-100')
  return classes.join(' ')
})

const rawText = computed(() => {
  if (props.content === null || props.content === undefined) return ''
  if (typeof props.content === 'object') return JSON.stringify(props.content, null, 2)
  return String(props.content)
})

const detectedFormat = computed(() => {
  if (props.format !== 'auto') return props.format
  const trimmed = rawText.value.trim()
  if (trimmed.startsWith('<')) return 'xml'
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return 'json'
  return 'text'
})

const formatted = computed(() => {
  const text = rawText.value
  if (detectedFormat.value === 'json') {
    try {
      const parsed = typeof props.content === 'object' ? props.content : JSON.parse(text)
      return JSON.stringify(parsed, null, 2)
    } catch (e) {
      return text
    }
  }
  return text
})

const highlighted = computed(() => {
  const text = escapeHtml(formatted.value)
  if (detectedFormat.value === 'json') return highlightJson(text)
  if (detectedFormat.value === 'xml') return highlightXml(text)
  return text
})

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function highlightJson(text) {
  return text
    // Strings (keys and values) — match "..." patterns
    .replace(/(&quot;|")((?:\\.|[^"\\])*)(&quot;|")/g, (match, q1, content, q2) => {
      return `<span class="text-green-700">"${content}"</span>`
    })
    // Then handle key: value pattern — keys become purple
    .replace(/<span class="text-green-700">("(?:\\.|[^"\\])*")<\/span>\s*:/g, (match, key) => {
      return `<span class="text-purple-700">${key}</span>:`
    })
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, (match, num) => {
      return `: <span class="text-blue-600">${num}</span>`
    })
    // Booleans and null
    .replace(/:\s*(true|false|null)\b/g, (match, val) => {
      return `: <span class="text-amber-600">${val}</span>`
    })
    // Template variables {{...}}
    .replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      return `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`
    })
}

function highlightXml(text) {
  return text
    // Tags
    .replace(/&lt;(\/?)([\w:-]+)/g, (match, slash, tag) => {
      return `&lt;${slash}<span class="text-blue-700 font-semibold">${tag}</span>`
    })
    // Attributes
    .replace(/([\w:-]+)=(&quot;|")((?:\\.|[^"\\])*)(&quot;|")/g, (match, attr, q1, val, q2) => {
      return `<span class="text-purple-600">${attr}</span>=<span class="text-green-700">"${val}"</span>`
    })
    // Template variables
    .replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      return `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`
    })
}

function copyContent() {
  navigator.clipboard.writeText(rawText.value)
    .then(() => notificationStore.showToast('Copied', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
}
</script>
