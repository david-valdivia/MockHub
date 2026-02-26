<template>
  <div class="relative group/sh">
    <div
      ref="contentRef"
      class="text-xs font-mono rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all"
      :class="bgClass"
      v-html="highlighted"
      @click="handleValueClick"
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
import { computed, ref } from 'vue'
import { ClipboardDocumentIcon } from '@heroicons/vue/24/outline'
import { useNotificationStore } from '@/stores/notificationStore'

const props = defineProps({
  content: { type: [String, Object], default: '' },
  format: { type: String, default: 'json' }, // 'json' | 'xml' | 'auto'
  maxHeight: { type: String, default: 'max-h-64' },
  bg: { type: String, default: 'gray' } // 'gray' | 'blue'
})

const notificationStore = useNotificationStore()
const contentRef = ref(null)

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

function formatXml(xml) {
  let formatted = ''
  let indent = 0
  // Normalize: collapse whitespace between tags
  const normalized = xml.replace(/>\s+</g, '><').trim()
  const tokens = normalized.split(/(<[^>]+>)/).filter(Boolean)
  for (const token of tokens) {
    if (token.startsWith('</')) {
      indent--
      formatted += '  '.repeat(Math.max(0, indent)) + token + '\n'
    } else if (token.startsWith('<?') || token.startsWith('<!')) {
      formatted += '  '.repeat(Math.max(0, indent)) + token + '\n'
    } else if (token.startsWith('<') && token.endsWith('/>')) {
      formatted += '  '.repeat(Math.max(0, indent)) + token + '\n'
    } else if (token.startsWith('<')) {
      formatted += '  '.repeat(Math.max(0, indent)) + token + '\n'
      indent++
    } else {
      // Text content — append to previous line (remove trailing newline, add text, re-add newline)
      if (formatted.endsWith('\n')) {
        formatted = formatted.slice(0, -1) + token + '\n'
      } else {
        formatted += token
      }
    }
  }
  return formatted.trim()
}

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
  if (detectedFormat.value === 'xml') {
    try { return formatXml(text) } catch (e) { return text }
  }
  return text
})

function handleValueClick(event) {
  const el = event.target.closest('[data-copyval]')
  if (!el) return
  const val = el.getAttribute('data-copyval')
  navigator.clipboard.writeText(val)
    .then(() => notificationStore.showToast(`Copied: ${val.length > 40 ? val.slice(0, 40) + '...' : val}`, 'success'))
    .catch(() => {})
}

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
  const cv = 'cursor-pointer hover:bg-yellow-100/80 rounded px-0.5 -mx-0.5 transition-colors'
  return text
    // Strings (keys and values) — match "..." patterns
    .replace(/(&quot;|")((?:\\.|[^"\\])*)(&quot;|")/g, (match, q1, content, q2) => {
      return `<span class="text-green-700 ${cv}" data-copyval="${content}">"${content}"</span>`
    })
    // Then handle key: value pattern — keys become purple (not copyable as values)
    .replace(/<span class="text-green-700[^"]*"[^>]*data-copyval="[^"]*">("(?:\\.|[^"\\])*")<\/span>\s*:/g, (match, key) => {
      return `<span class="text-purple-700">${key}</span>:`
    })
    // Numbers
    .replace(/:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, (match, num) => {
      return `: <span class="text-blue-600 ${cv}" data-copyval="${num}">${num}</span>`
    })
    // Booleans and null
    .replace(/:\s*(true|false|null)\b/g, (match, val) => {
      return `: <span class="text-amber-600 ${cv}" data-copyval="${val}">${val}</span>`
    })
    // Template variables {{...}}
    .replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
      return `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`
    })
}

function highlightXml(text) {
  const cv = 'cursor-pointer hover:bg-yellow-100/80 rounded px-0.5 -mx-0.5 transition-colors'
  const tagCv = 'cursor-pointer hover:bg-blue-100/80 rounded px-0.5 -mx-0.5 transition-colors'
  const TAG_RE = /&lt;(\/?)([\w:-]+)((?:\s+[\w:-]+=(?:&quot;[^&]*&quot;|"[^"]*"|'[^']*'))*\s*)(\/?)&gt;/g

  // --- Pass 1: build tree to detect arrays (sibling tags with same name) ---
  const root = { tag: '', children: [] }
  let scanStack = [root]
  const nodeOrder = [] // opening tags in document order
  const scanRe = new RegExp(TAG_RE.source, 'g')
  let sm
  while ((sm = scanRe.exec(text)) !== null) {
    const [, slash, tag, , selfClose] = sm
    if (slash === '/') {
      scanStack.pop()
    } else {
      const parent = scanStack[scanStack.length - 1]
      const node = { tag, children: [], parent }
      parent.children.push(node)
      nodeOrder.push(node)
      if (selfClose !== '/') scanStack.push(node)
    }
  }

  // Compute indices — only add index when siblings share the same tag name
  function computeTree(node) {
    const counts = {}
    for (const child of node.children) counts[child.tag] = (counts[child.tag] || 0) + 1
    const idx = {}
    for (const child of node.children) {
      const total = counts[child.tag]
      child.needsIndex = total > 1
      child.index = idx[child.tag] || 0
      idx[child.tag] = child.index + 1
      computeTree(child)
    }
  }
  computeTree(root)

  // Compute full dot-path for each node (matches fast-xml-parser structure)
  function computePath(node) {
    const parentPath = (!node.parent || node.parent === root) ? '' : node.parent.path
    node.path = (parentPath ? parentPath + '.' : '') + node.tag
    if (node.needsIndex) node.path += '.' + node.index
    for (const child of node.children) computePath(child)
  }
  for (const child of root.children) computePath(child)

  // --- Pass 2: highlight with correct paths ---
  let nodeIdx = 0
  const pathStack = [] // current node stack for closing tags
  let result = ''
  let lastIndex = 0
  const renderRe = new RegExp(TAG_RE.source, 'g')
  let m

  while ((m = renderRe.exec(text)) !== null) {
    // Text before this tag
    const before = text.slice(lastIndex, m.index)
    if (before.trim()) {
      const parentPath = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : ''
      const textPath = parentPath ? parentPath + '.#text' : '#text'
      const trimmed = before.trim()
      const escapedVal = trimmed.replace(/"/g, '&quot;')
      result += before.replace(trimmed, `<span class="text-gray-900 ${cv}" data-copyval="${escapedVal}" data-pathval="${textPath}">${trimmed}</span>`)
    } else {
      result += before
    }

    const [fullMatch, slash, tag, attrs, selfClose] = m

    let path
    if (slash === '/') {
      path = pathStack.length > 0 ? pathStack[pathStack.length - 1].path : tag
      pathStack.pop()
    } else {
      const node = nodeOrder[nodeIdx++]
      path = node.path
      if (selfClose !== '/') pathStack.push(node)
    }

    // Highlight attributes
    let attrHtml = attrs.replace(/([\w:-]+)=((?:&quot;[^&]*&quot;|"[^"]*"|'[^']*'))/g,
      (am, a, v) => {
        const attrPath = `${path}.@_${a}`
        const esc = attrPath.replace(/"/g, '&quot;')
        return ` <span class="text-purple-600 ${tagCv}" data-copyval="${esc}">${a}</span>=<span class="text-green-700 ${tagCv}" data-copyval="${esc}">${v}</span>`
      }
    )

    const escapedPath = path.replace(/"/g, '&quot;')
    result += `&lt;${slash}<span class="text-blue-700 font-semibold ${tagCv}" data-copyval="${escapedPath}">${tag}</span>${attrHtml}${selfClose}&gt;`
    lastIndex = m.index + fullMatch.length
  }

  result += text.slice(lastIndex)

  // Template variables
  result = result.replace(/\{\{([^}]+)\}\}/g, (match, expr) => {
    return `<span class="text-rose-500 font-semibold">{{${expr}}}</span>`
  })

  return result
}

function copyContent() {
  navigator.clipboard.writeText(rawText.value)
    .then(() => notificationStore.showToast('Copied', 'success'))
    .catch(() => notificationStore.showToast('Failed to copy', 'error'))
}
</script>
